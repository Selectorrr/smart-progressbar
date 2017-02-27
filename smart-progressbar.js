'use strict';

angular.module('smart-progressbar', [])
    .constant('spOptionsDefaults', {
        'background-color': 'white',
        'z-index': '2147483647',
        transition: 'all 0.5s ease',
        opacity: '0.5',
        sensitivity: 500,
        delayTrashHold: 50,
        minDuration: 700
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

        var progress = angular.element('<div></div>');
        progress.css({
            position: 'absolute',
            top: '0',
            bottom: '0',
            left: '0',
            right: '0',
            'z-index': spOptions['z-index'],
            visibility: 'hidden',
            transition: spOptions.transition,
            'background-color': spOptions['background-color']
        });
        angular.element(document.body).append(progress);

        $rootScope.$watch(_AspPromiseTracker.active, function (isActive) {
            if (isActive) {
                progress.css({visibility: 'visible', opacity: spOptions.opacity})
            } else {
                progress.css({visibility: 'hidden', opacity: '0'})
            }
        })
    })
;