'use strict';

var Handler = (function () {
    var module     = {};
    var defined    = {};
    var handlerCtr = 0;

    var reservedKeywords = ['id'];
    var handlerMethods =
        ['onException', 'onNativeException', 'onLibraryException', 'onApplicationException', 'onNetworkException'];
    var callInterface =
        ['callName', 'callArgs', 'callError', 'callResult', 'callRetry', 'retry', 'alternateCall', 'fail', 'succeed', 'continue', 'proceed', 'hasFailureContinuation', 'isCallErrorType'];
    var handlerContext   = 'ctxt';
    var prioritySign     = '+';
    var annotationRegExp = /[\,\s]+([+]?[a-zA-Z_$]{1}[a-zA-Z0-9_$]*)([\[]{1}[a-zA-Z0-9_$,:\'\"]*[\]]{1})*/g;
    var annotationOverridesRegExp = /[\[]*[,\s]*([a-zA-Z-0-9_]+)[:\s]{1}([0-9a-zA-Z\'\"_\s]+)[\]]*/g;

    var makeLeafName = function (name) {
        return name + 'Handler';
    };

    var makeProxyName = function (name) {
        return 'Proxy' + name.slice(-1);
    };

    var generate   = handlerGenerate();
    var transform  = handlerTransform();
    var predefined = handlerPreDefined();

    var init = function () {
        Handler.handlerCtr = 0;
        Handler.defined = {};
        Handler.Predefined.generate();

    };

    module.defined    = defined;
    module.handlerCtr = handlerCtr;
    module.init       = init;

    module.reservedKeywords    = reservedKeywords;
    module.handlerMethods   = handlerMethods;
    module.callInterface    = callInterface;
    module.prioritySign     = prioritySign;
    module.handlerUseRegExp = annotationRegExp;
    module.handlerOverrideRegExp = annotationOverridesRegExp;
    module.handlerContext = handlerContext;

    module.makeLeafName  = makeLeafName;
    module.makeProxyName = makeProxyName;

    module.Generate   = generate;
    module.Transform  = transform;
    module.Predefined = predefined;

    return module;
})();