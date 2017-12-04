google.load('visualization', '1', {packages: ['columnchart']});

function initMap() {

    var elevator = new google.maps.ElevationService;
    var infowindow = new google.maps.InfoWindow({map: map});
    var directionsRenderer = new google.maps.DirectionsRenderer();
    var directionsService = new google.maps.DirectionsService();

    var currentLocation = new google.maps.LatLng(24.664217, 46.4090183);

    var mapOptions = {
        zoom: 10,
        center: currentLocation
    };
    var map = new google.maps.Map(document.getElementById('map'), mapOptions);

    var clickedPositionMarker = null;
    var targetMarkers = [];
    var highestPositionMarkers = [];

    var circle = null;
    var polylines = [];
    var routes = [];
    var elevationsData = [];

    var elevationIntervalId = 0;

    directionsRenderer.setMap(map);

    // Add a listener for the click event. Display the elevation for the LatLng of
    // the click inside the infowindow.
    map.addListener('click', function (event) {

        removeMarkers();

        /*clickedPositionMarker = new google.maps.Marker({
            position: event.latLng,
            map: map,
            draggable: true
        });*/

        currentLocation = event.latLng;
        map.setCenter(currentLocation);
        drawCircle();

        var range = $('#kmToTravel').val() * 1000 / 100000;
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

            /*var marker = new google.maps.Marker({
                position: lat_long,
                map: map
            });
            targetMarkers.push(marker);*/

            targetMarkers.push(lat_long);

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

        for (var i in targetMarkers) {

            var end = new google.maps.LatLng(targetMarkers[i].lat(), targetMarkers[i].lng());

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
                        /*var line = drawPolyline(response.routes[k].overview_path, '#ffffff');
                        polylines.push(line);*/
                        routes.push(response.routes[k].overview_path);

                        //highlightRoute(0);

                        //bounds = line.getBounds(bounds);
                        /*google.maps.event.addListener(line, 'click', function () {
                            // detect which route was clicked on
                            var index = polylines.indexOf(this);
                            highlightRoute(index);
                        });*/

                        $('#elevation_chart').html($('#elevation_chart').html() + 'Route fetched <br>');
                    }
                    //map.fitBounds(bounds);
                } else {
                    $('#elevation_chart').html($('#elevation_chart').html() + "Failed in fetching route: " + status + '<br>');
                }
            });
        }

        setTimeout(function () {
            elevationIntervalId = setInterval(getPathElevation, 1500);
        }, 6000);
    }

    var _elevationSorter = function(a, b) {
        return b.elevation - a.elevation;
    };

    function showHighestElevationMarkers() {
        // highest elevations are the first element, make an array of only highest elevation elements
        elevationsData = elevationsData.map(function (v, i) {
            return v[0];
        });

        elevationsData.sort(_elevationSorter);

        for(var i = 0; i<3; i++) {
            var marker = new google.maps.Marker({
                position: elevationsData[i].location,
                map: map
            });

            highestPositionMarkers.push(marker);
            displayLocationElevation(marker, elevationsData[i]);
        }

        $('#elevation_chart').html('Results fetched successfully.');
    }

    function removeMarkers() {
        directionsRenderer.setDirections({routes: []});

        if (clickedPositionMarker != null) {
            clickedPositionMarker.setMap(null);
        }

        for (var i in highestPositionMarkers) {
            highestPositionMarkers[i].setMap(null);
        }
        highestPositionMarkers = [];

        /*for (var i in targetMarkers) {
         targetMarkers[i].setMap(null);
         }*/
        targetMarkers = [];
    }

    var count = 0;

    function getPathElevation() {

        var route = routes[count];

        // Create a PathElevationRequest object using this array.
        // Ask for 256 samples along that path.
        // Initiate the path request.
        elevator.getElevationAlongPath({
            'path': route,
            'samples': 128
        }, plotElevation);

        count++;
        if(count > routes.length) {
            count = 0;
            clearInterval(elevationIntervalId);
            showHighestElevationMarkers();
        }
    }

    function plotElevation(elevations, status) {

        console.log(status);
        if (status !== 'OK') {
            // Show the error code inside the chartDiv.
            $('#elevation_chart').html($('#elevation_chart').html() + 'Cannot show elevation: request failed because ' + status + '<br>');
            return;
        }

        $('#elevation_chart').html($('#elevation_chart').html() + 'Elevation fetched for route<br>');

        elevations.sort(_elevationSorter);
        elevationsData.push(elevations);
    }

    function drawCircle() {
        if (circle != null) {
            circle.setMap(null);
        }
        circle = new google.maps.Circle({
            map: map,
            radius: 1000 * $('#kmToTravel').val(),    // in meters
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

    function displayLocationElevation(marker, elevation) {
        console.log('Elevation: ' + elevation.elevation.toFixed(2) + ' meters');
        var infowindow = new google.maps.InfoWindow({
            content: 'Elevation: ' + elevation.elevation.toFixed(2) + ' meters'
        });

        infowindow.open(map, marker);
    }

    //findLocation();
    //map.setCenter(currentLocation);
}

