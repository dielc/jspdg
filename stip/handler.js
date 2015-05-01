'use strict';

var Handler = (function () {
	var module     = {};
	var defined    = {};
	var handlerCtr = 0;

	var handlerMethods   = ['onException', 'onNativeException', 'onLibraryException', 'onApplicationException', 'onNetworkException'];
	var handlerContext   = 'ctxt';
	var prioritySign     = '+';
	var annotationRegExp = /[\,\s]+([+]?[a-zA-Z_$]{1}[a-zA-Z0-9_$]*)/g;

	var generate   = handlerGenerate();
	var transform  = handlerTransform();
	var predefined = handlerPreDefined();

	var init = function(){
		Handler.defined    = Handler.Predefined.predefinedHandlers();
		Handler.handlerCtr = 0;
	}


	module.defined    = defined;
	module.handlerCtr = handlerCtr;
	module.init       = init;

	module.handlerMethods   = handlerMethods;
	module.prioritySign     = prioritySign;
	module.handlerUseRegExp = annotationRegExp;
	module.handlerContext   = handlerContext;

	module.Generate   = generate;
	module.Transform  = transform;
	module.Predefined = predefined;

	return module;
})();