/**
 */

'use strict';

angular.module('myApp').controller('HomeCtrl', ['$scope', '$http', '$sce', function ($scope, $http, $sce) {
    $scope.posts = [];
    $scope.section = null;
    $scope.subreddit = null;
    $scope.subreddits = ['cats', 'pics', 'funny', 'gaming', 'AdviceAnimals', 'aww'];

    var getRandomSubreddit = function () {
        var sub = $scope.subreddits[Math.floor(Math.random() * $scope.subreddits.length)];

        // ensure we get a new subreddit each time.
        if (sub == $scope.subreddit) {
            return getRandomSubreddit();
        }

        return sub;
    };

    $scope.fetch = function () {
        $scope.subreddit = getRandomSubreddit();
        // see how there's no need to keep track of these XHR requests?
        // the interceptor is doing all the work in the background
        // your controllers and services don't need to know anything about it!

        var url = 'https://www.reddit.com/r/' + $scope.subreddit + '.json?limit=100&callback=JSON_CALLBACK';
        // $sce.trustAsResourceUrl(url);

        $http.get(url)
            .then(function (response) {
                // we're requesting 100 entries just to exaggerate the loading bar's progress
                // since this is just for an example, don't display all 100, just the first 5
                var posts = response.data.data.children.slice(0, 5);
                $scope.posts = posts;
            });
    };
}]);