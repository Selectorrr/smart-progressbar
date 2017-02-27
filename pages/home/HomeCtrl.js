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
        if (sub == $scope.subreddit) {
            return getRandomSubreddit();
        }

        return sub;
    };

    function getUrl() {
        $scope.subreddit = getRandomSubreddit();
        return 'https://www.reddit.com/r/' + $scope.subreddit + '.json?limit=100&callback=JSON_CALLBACK';
    }

    function onSuccess(response) {
        $scope.posts = response.data.data.children.slice(0, 5);
    }

    $scope.fetch = function () {
        $http.get(getUrl())
            .then(onSuccess);
    };

    $scope.fetchWithSkipProgressBar = function () {
        $http.get(getUrl(), {skipProgressBar: true})
            .then(onSuccess);
    };
}]);