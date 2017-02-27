/**
 @toc
 1. setup - whitelist, appPath, html5Mode
 */

'use strict';

angular.module('myApp', [
    'ngRoute', 'ngSanitize', 'ngTouch', 'smart-progressbar'])
    .constant('spOptions', {'background-color': 'black'})
    .config(['$routeProvider', '$locationProvider',
        function ($routeProvider, $locationProvider) {
            $locationProvider.html5Mode(false);
            var staticPath;
            staticPath = '/smart-progressbar/';
            var appPathRoute = '/';
            var pagesPath = staticPath + 'pages/';
            $routeProvider.when(appPathRoute + 'home', {templateUrl: pagesPath + 'home/home.html'});
            $routeProvider.otherwise({redirectTo: appPathRoute + 'home'});

        }]);