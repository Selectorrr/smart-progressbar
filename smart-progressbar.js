'use strict';

angular.module('smart-progressbar', [])
    .constant('spOptionsDefaults', {
        'background-color': 'white',
        'z-index': '2147483647',
        transition: 'all 0.5s ease',
        opacity: '0.5',
        sensitivity: 500,
        delayTrashHold: 50,
        minDuration: 700,
        'spinner-color': 'white'
    })
    .config(['$provide', '$injector', 'spOptionsDefaults', function ($provide, $injector, spOptionsDefaults) {

        var spOptions = spOptionsDefaults;
        if ($injector.has('spOptions')) {
            spOptions = angular.extend(spOptions, $injector.get('spOptions'));
        }

        $provide.decorator('ngClickDirective', [
            '$delegate', '$parse',
            function ($delegate, $parse) {
                $delegate[0].compile = function ($element, attr) {
                    var originalFn = $parse(attr['ngClick']);
                    var fn = debounce(originalFn, spOptions.sensitivity, {
                        leading: true,
                        trailing: false
                    });
                    return function ngEventHandler(scope, element) {
                        element.on('click', function (event) {
                            var callback = function () {
                                if (!attr['allowDoubleClick']) {
                                    fn(scope, {$event: event});
                                } else {
                                    originalFn(scope, {$event: event});
                                }
                            };
                            scope.$apply(callback);
                        });
                    };
                };
                return $delegate;
            }
        ]);

        $provide.decorator('$http', ['$delegate', '_AspPromiseTracker',
            function ($delegate, _AspPromiseTracker) {
                angular.forEach('get post put delete jsonp head patch'.split(' '), function (method) {
                    var original = $delegate[method];
                    $delegate[method] = function decorated() {
                        var promise = original.apply($delegate, arguments);
                        if (!(arguments[1] && arguments[1].skipProgressBar)) {
                            _AspPromiseTracker.reset({
                                promises: [promise],
                                delay: spOptions.sensitivity - spOptions.delayTrashHold,
                                minDuration: spOptions.minDuration
                            });
                        }
                        return promise;
                    };
                });
                return $delegate;
            }]);

        function debounce(func, wait, options) {
            var lastArgs,
                lastThis,
                maxWait,
                result,
                timerId,
                lastCallTime;

            var lastInvokeTime = 0;
            var leading = false;
            var maxing = false;
            var trailing = true;

            if (typeof func != 'function') {
                throw new TypeError('Expected a function')
            }
            wait = wait || 0;
            if (options) {
                leading = !!options.leading;
                maxing = 'maxWait' in options;
                maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
                trailing = 'trailing' in options ? !!options.trailing : trailing
            }

            function invokeFunc(time) {
                const args = lastArgs;
                const thisArg = lastThis;

                lastArgs = lastThis = undefined;
                lastInvokeTime = time;
                result = func.apply(thisArg, args);
                return result
            }

            function leadingEdge(time) {
                // Reset any `maxWait` timer.
                lastInvokeTime = time;
                // Start the timer for the trailing edge.
                timerId = setTimeout(timerExpired, wait);
                // Invoke the leading edge.
                return leading ? invokeFunc(time) : result
            }

            function remainingWait(time) {
                const timeSinceLastCall = time - lastCallTime;
                const timeSinceLastInvoke = time - lastInvokeTime;
                const result = wait - timeSinceLastCall;

                return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result
            }

            function shouldInvoke(time) {
                const timeSinceLastCall = time - lastCallTime;
                const timeSinceLastInvoke = time - lastInvokeTime;

                // Either this is the first call, activity has stopped and we're at the
                // trailing edge, the system time has gone backwards and we're treating
                // it as the trailing edge, or we've hit the `maxWait` limit.
                return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
                (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait))
            }

            function timerExpired() {
                const time = Date.now();
                if (shouldInvoke(time)) {
                    return trailingEdge(time)
                }
                // Restart the timer.
                timerId = setTimeout(timerExpired, remainingWait(time))
            }

            function trailingEdge(time) {
                timerId = undefined;

                // Only invoke if we have `lastArgs` which means `func` has been
                // debounced at least once.
                if (trailing && lastArgs) {
                    return invokeFunc(time)
                }
                lastArgs = lastThis = undefined;
                return result
            }

            function cancel() {
                if (timerId !== undefined) {
                    clearTimeout(timerId)
                }
                lastInvokeTime = 0;
                lastArgs = lastCallTime = lastThis = timerId = undefined
            }

            function flush() {
                return timerId === undefined ? result : trailingEdge(Date.now())
            }

            function debounced() {
                const time = Date.now();
                const isInvoking = shouldInvoke(time);

                lastArgs = arguments;
                lastThis = this;
                lastCallTime = time;

                if (isInvoking) {
                    if (timerId === undefined) {
                        return leadingEdge(lastCallTime)
                    }
                    if (maxing) {
                        // Handle invocations in a tight loop.
                        timerId = setTimeout(timerExpired, wait);
                        return invokeFunc(lastCallTime)
                    }
                }
                if (timerId === undefined) {
                    timerId = setTimeout(timerExpired, wait)
                }
                return result
            }

            debounced.cancel = cancel;
            debounced.flush = flush;
            return debounced
        }
    }])
    .service('_AspPromiseTracker', ['$timeout', '$q', 'spOptionsDefaults', '$injector',
        function ($timeout, $q, spOptionsDefaults, $injector) {
            var spOptions = spOptionsDefaults;
            if ($injector.has('spOptions')) {
                spOptions = angular.extend(spOptions, $injector.get('spOptions'));
            }
            var tracker = {};
            tracker.promises = [];
            tracker.delayPromise = null;
            tracker.durationPromise = null;
            tracker.delayJustFinished = false;

            tracker.reset = function (options) {
                tracker.minDuration = options.minDuration;

                tracker.promises = [];
                angular.forEach(options.promises, function (p) {
                    if (!p || p.$aspFulfilled) {
                        return;
                    }
                    addPromiseLikeThing(p);
                });

                if (tracker.promises.length === 0) {
                    //if we have no promises then dont do the delay or duration stuff
                    return;
                }

                tracker.delayJustFinished = false;
                if (options.delay) {
                    tracker.delayPromise = $timeout(function () {
                        tracker.delayPromise = null;
                        tracker.delayJustFinished = true;
                    }, parseInt(options.delay, 10));
                }
                if (options.minDuration) {
                    tracker.durationPromise = $timeout(function () {
                        tracker.durationPromise = null;
                    }, parseInt(options.minDuration, 10) + (options.delay ? parseInt(options.delay, 10) : 0));
                }
            };

            tracker.isPromise = function (promiseThing) {
                var then = promiseThing && (promiseThing.then || promiseThing.$then ||
                    (promiseThing.$promise && promiseThing.$promise.then));

                return typeof then !== 'undefined';
            };

            tracker.callThen = function (promiseThing, success, error) {
                var promise;
                if (promiseThing.then || promiseThing.$then) {
                    promise = promiseThing;
                } else if (promiseThing.$promise) {
                    promise = promiseThing.$promise;
                } else if (promiseThing.denodeify) {
                    promise = $q.when(promiseThing);
                }

                var then = (promise.then || promise.$then);

                then.call(promise, success, error);
            };

            var addPromiseLikeThing = function (promise) {

                if (!tracker.isPromise(promise)) {
                    throw new Error('asp expects a promise (or something that has a .promise or .$promise');
                }

                if (tracker.promises.indexOf(promise) !== -1) {
                    return;
                }
                tracker.promises.push(promise);

                tracker.callThen(promise, function () {
                    promise.$aspFulfilled = true;
                    if (tracker.promises.indexOf(promise) === -1) {
                        return;
                    }
                    tracker.promises.splice(tracker.promises.indexOf(promise), 1);
                }, function () {
                    promise.$aspFulfilled = true;
                    if (tracker.promises.indexOf(promise) === -1) {
                        return;
                    }
                    tracker.promises.splice(tracker.promises.indexOf(promise), 1);
                });
            };

            tracker.active = function () {
                if (tracker.delayPromise) {
                    return false;
                }

                if (!tracker.delayJustFinished) {
                    if (tracker.durationPromise) {
                        return true;
                    }
                    return tracker.promises.length > 0;
                } else {
                    //if both delay and min duration are set,
                    //we don't want to initiate the min duration if the
                    //promise finished before the delay was compvare
                    tracker.delayJustFinished = false;
                    if (tracker.promises.length === 0) {
                        tracker.durationPromise = null;
                    }
                    return tracker.promises.length > 0;
                }
            };

            return tracker;
        }])
    .run(function ($rootScope, _AspPromiseTracker, spOptionsDefaults, $injector) {
        var spOptions = spOptionsDefaults;
        if ($injector.has('spOptions')) {
            spOptions = angular.extend(spOptions, $injector.get('spOptions'));
        }

        var progress = angular
            .element('<div class="sk-wrapper"><div class="sk-circle"><div class="sk-circle1 sk-child"></div> ' +
                '<div class="sk-circle2 sk-child"></div> <div class="sk-circle3 sk-child"></div> ' +
                '<div class="sk-circle4 sk-child"></div> <div class="sk-circle5 sk-child"></div> ' +
                '<div class="sk-circle6 sk-child"></div> <div class="sk-circle7 sk-child"></div> ' +
                '<div class="sk-circle8 sk-child"></div> <div class="sk-circle9 sk-child"></div> ' +
                '<div class="sk-circle10 sk-child"></div> <div class="sk-circle11 sk-child"></div> ' +
                '<div class="sk-circle12 sk-child"></div> </div></div>');
        angular.element(document.body).append(progress);

        angular.element(document.head).append(angular.element('<style type="text/css">.sk-wrapper{position: fixed;' +
            'top: 0;left: 0;right: 0;bottom: 0;z-index: ' + spOptions['z-index'] + ';visibility: hidden;transition: '
            + spOptions.transition + ';background-color: ' + spOptions['background-color'] + ';}' +
            '.sk-circle{margin:auto;width:40px;height:40px;position: absolute;top: 0;left: 0;right: 0;bottom: 0;}' +
            '.sk-circle .sk-child{width:100%;height:100%;position:absolute;left:0;top:0}.sk-circle ' +
            '.sk-child:before{content:\'\';display:block;margin:0 auto;width:15%;height:15%;background-color:'+spOptions['spinner-color']+';' +
            'border-radius:100%;-webkit-animation:sk-circleBounceDelay 1.2s infinite ease-in-out both;' +
            'animation:sk-circleBounceDelay 1.2s infinite ease-in-out both}.sk-circle ' +
            '.sk-circle2{-webkit-transform:rotate(30deg);-ms-transform:rotate(30deg);transform:rotate(30deg)}' +
            '.sk-circle .sk-circle3{-webkit-transform:rotate(60deg);-ms-transform:rotate(60deg);transform:rotate(60deg)}' +
            '.sk-circle .sk-circle4{-webkit-transform:rotate(90deg);-ms-transform:rotate(90deg);transform:rotate(90deg)}' +
            '.sk-circle .sk-circle5{-webkit-transform:rotate(120deg);-ms-transform:rotate(120deg);transform:rotate(120deg)}' +
            '.sk-circle .sk-circle6{-webkit-transform:rotate(150deg);-ms-transform:rotate(150deg);transform:rotate(150deg)}' +
            '.sk-circle .sk-circle7{-webkit-transform:rotate(180deg);-ms-transform:rotate(180deg);transform:rotate(180deg)}' +
            '.sk-circle .sk-circle8{-webkit-transform:rotate(210deg);-ms-transform:rotate(210deg);transform:rotate(210deg)}' +
            '.sk-circle .sk-circle9{-webkit-transform:rotate(240deg);-ms-transform:rotate(240deg);transform:rotate(240deg)}' +
            '.sk-circle .sk-circle10{-webkit-transform:rotate(270deg);-ms-transform:rotate(270deg);transform:rotate(270deg)}' +
            '.sk-circle .sk-circle11{-webkit-transform:rotate(300deg);-ms-transform:rotate(300deg);transform:rotate(300deg)}' +
            '.sk-circle .sk-circle12{-webkit-transform:rotate(330deg);-ms-transform:rotate(330deg);transform:rotate(330deg)}' +
            '.sk-circle .sk-circle2:before{-webkit-animation-delay:-1.1s;animation-delay:-1.1s}.sk-circle ' +
            '.sk-circle3:before{-webkit-animation-delay:-1s;animation-delay:-1s}.sk-circle ' +
            '.sk-circle4:before{-webkit-animation-delay:-.9s;animation-delay:-.9s}.sk-circle ' +
            '.sk-circle5:before{-webkit-animation-delay:-.8s;animation-delay:-.8s}.sk-circle ' +
            '.sk-circle6:before{-webkit-animation-delay:-.7s;animation-delay:-.7s}.sk-circle ' +
            '.sk-circle7:before{-webkit-animation-delay:-.6s;animation-delay:-.6s}.sk-circle ' +
            '.sk-circle8:before{-webkit-animation-delay:-.5s;animation-delay:-.5s}.sk-circle ' +
            '.sk-circle9:before{-webkit-animation-delay:-.4s;animation-delay:-.4s}.sk-circle ' +
            '.sk-circle10:before{-webkit-animation-delay:-.3s;animation-delay:-.3s}.sk-circle ' +
            '.sk-circle11:before{-webkit-animation-delay:-.2s;animation-delay:-.2s}.sk-circle ' +
            '.sk-circle12:before{-webkit-animation-delay:-.1s;animation-delay:-.1s}@-webkit-keyframes ' +
            'sk-circleBounceDelay{0%,80%,100%{-webkit-transform:scale(0);transform:scale(0)}40%{-webkit-transform:scale(1);' +
            'transform:scale(1)}}@keyframes sk-circleBounceDelay{0%,80%,100%{-webkit-transform:scale(0);' +
            'transform:scale(0)}40%{-webkit-transform:scale(1);transform:scale(1)}}</style>'));

        $rootScope.$watch(_AspPromiseTracker.active, function (isActive) {
            if (isActive) {
                progress.css({visibility: 'visible', opacity: spOptions.opacity})
            } else {
                progress.css({visibility: 'hidden', opacity: '0'})
            }
        })
    })
;