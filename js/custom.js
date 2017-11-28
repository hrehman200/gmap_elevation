google.load('visualization', '1', {packages: ['columnchart']});

function initMap() {

    var elevator = new google.maps.ElevationService;
    var infowindow = new google.maps.InfoWindow({map: map});
    var directionsRenderer = new google.maps.DirectionsRenderer();
    var directionsService = new google.maps.DirectionsService();

    var mapOptions = {
        zoom: 20
    };
    var map = new google.maps.Map(document.getElementById('map'), mapOptions);

    var clickedPositionMarker = null;
    var markers = [];
    var highestPositionMarkers = [];

    var currentLocation = null;
    var circle = null;
    var polylines = [];
    var routes = [];
    var elevationsData = [];

    directionsRenderer.setMap(map);

    // Add a listener for the click event. Display the elevation for the LatLng of
    // the click inside the infowindow.
    map.addListener('click', function (event) {

        removeMarkers();

        clickedPositionMarker = new google.maps.Marker({
            position: event.latLng,
            map: map,
            draggable: true
        });

        currentLocation = event.latLng;
        map.setCenter(currentLocation);
        drawCircle();

        var range = 1;
        findCoordinates(event.latLng.lat(), event.latLng.lng(), range);
    });

    function findCoordinates(lat, long, range) {
        var numberOfPoints = 8;
        var degreesPerPoint = 45;
        var dg = 90;

        for (var i = 0; i < numberOfPoints; i++) {
            var newLat = Math.sin(dg * Math.PI / 180) * range + lat;
            var newLng = Math.cos(dg * Math.PI / 180) * range + long;

            var lat_long = new google.maps.LatLng(newLat, newLng);
            var marker = new google.maps.Marker({
                position: lat_long,
                map: map
            });
            markers.push(marker);

            dg += degreesPerPoint;
        }

        calcRoute();
    }

    function findLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                var marker = new google.maps.Marker({
                    position: currentLocation,
                    map: map,
                    icon: 'http://i.stack.imgur.com/orZ4x.png'
                });
                marker.setMap(map);
                map.setCenter(currentLocation);

            }, function () {
                alert('Failed in finding location');
            });
        }
    }

    function calcRoute() {

        var start = new google.maps.LatLng(currentLocation.lat(), currentLocation.lng());

        // clear former polylines
        for (var j in  polylines) {
            polylines[j].setMap(null);
        }
        polylines = [];
        elevationsData = [];
        routes = [];

        for (var i in markers) {

            var end = new google.maps.LatLng(markers[i].getPosition().lat(), markers[i].getPosition().lng());

            var bounds = new google.maps.LatLngBounds();
            bounds.extend(start);
            bounds.extend(end);
            //map.fitBounds(bounds);
            var request = {
                origin: start,
                destination: end,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: true
            };

            directionsService.route(request, function (response, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    var bounds = new google.maps.LatLngBounds();
                    // draw the lines in reverse orde, so the first one is on top (z-index)
                    for (var k = response.routes.length - 1; k >= 0; k--) {
                        // let's make the first suggestion highlighted;
                        var line = drawPolyline(response.routes[k].overview_path, '#ffffff');
                        polylines.push(line);
                        routes.push(response.routes[k].overview_path);

                        highlightRoute(0);

                        //bounds = line.getBounds(bounds);
                        google.maps.event.addListener(line, 'click', function () {
                            // detect which route was clicked on
                            var index = polylines.indexOf(this);
                            highlightRoute(index);
                        });

                        getPathElevation(response.routes[k].overview_path);
                    }
                    //map.fitBounds(bounds);
                } else {
                    console.log("Directions Request from " + start.toUrlValue(6) + " to " + end.toUrlValue(6) + " failed: " + status);
                }
            });
        }

        setTimeout(function () {
            elevationsData.sort(function(a, b) {
                return b.elevation - a.elevation;
            });

            console.log(elevationsData);

            for(var i = 0; i<3; i++) {
                var marker = new google.maps.Marker({
                    position: elevationsData[i].location,
                    map: map
                });

                highestPositionMarkers.push(marker);
            }

        }, 5000);
    }

    function removeMarkers() {
        directionsRenderer.setDirections({routes: []});

        if (clickedPositionMarker != null) {
            clickedPositionMarker.setMap(null);
        }

        for(var i in highestPositionMarkers) {
            highestPositionMarkers[i].setMap(null);
        }
        highestPositionMarkers = [];

        for (var i in markers) {
            markers[i].setMap(null);
        }
        markers = [];
    }

    function placeMarker(location) {

        removeMarkers();

        var marker = new google.maps.Marker({
            position: location,
            map: map,
            draggable: true
        });
        markers.push(marker);
        calcRoute();
    }

    function getPathElevation(route) {

        // Create a PathElevationRequest object using this array.
        // Ask for 256 samples along that path.
        // Initiate the path request.
        elevator.getElevationAlongPath({
            'path': route,
            'samples': 256
        }, plotElevation);
    }

    function plotElevation(elevations, status) {

        var chartDiv = document.getElementById('elevation_chart');
        console.log(status);
        if (status !== 'OK') {
            // Show the error code inside the chartDiv.
            chartDiv.innerHTML = 'Cannot show elevation: request failed because ' +
                status;
            return;
        }
        // Create a new chart in the elevation_chart DIV.
        var chart = new google.visualization.ColumnChart(chartDiv);

        // Extract the data from which to populate the chart.
        // Because the samples are equidistant, the 'Sample'
        // column here does double duty as distance along the
        // X axis.
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Sample');
        data.addColumn('number', 'Elevation');
        for (var i = 0; i < elevations.length; i++) {
            data.addRow(['', elevations[i].elevation]);
        }

        // Draw the chart using the data within its DIV.
        chart.draw(data, {
            height: 150,
            legend: 'none',
            titleY: 'Elevation (m)'
        });

        $.merge(elevationsData, elevations);
    }

    function drawCircle() {
        if (circle != null) {
            circle.setMap(null);
        }
        circle = new google.maps.Circle({
            map: map,
            radius: 1609.344 * $('#milesToTravel').val(),    // in meters
            fillColor: '#ff56ab',
            center: currentLocation
        });

        map.fitBounds(circle.getBounds());

        /*google.maps.event.addListener(circle, 'click', function (ev) {
         placeMarker(ev.latLng);
         });*/
        //circle.bindTo('center', currentLocation, 'position');
    }

    function highlightRoute(index) {
        for (var j in  polylines) {
            var color = (j == index) ? '#0000ff' : '#999999';
            polylines[j].setOptions({strokeColor: color});
        }
    }

    function drawPolyline(path, color) {
        var line = new google.maps.Polyline({
            path: path,
            strokeColor: color,
            strokeOpacity: 0.7,
            strokeWeight: 10
        });
        line.setMap(map);
        return line;
    }

    function displayLocationElevation(location, elevator, infowindow) {
        // Initiate the location request
        elevator.getElevationForLocations({
            'locations': [location]
        }, function (results, status) {
            infowindow.setPosition(location);
            if (status === 'OK') {
                // Retrieve the first result
                if (results[0]) {
                    // Open the infowindow indicating the elevation at the clicked position.
                    infowindow.setContent('The elevation at this point <br>is ' +
                        results[0].elevation + ' meters.');
                } else {
                    infowindow.setContent('No results found');
                }
            } else {
                infowindow.setContent('Elevation service failed due to: ' + status);
            }
        });
    }

    $('#btnGo').click(function (e) {
        findLocation();
    }).click();
}

