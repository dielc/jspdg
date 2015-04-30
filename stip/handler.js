'use strict';

var Handler = (function () {
	var module    = {};
	var defined   = {};

	var handlerMethods   = ['onException', 'onNativeException', 'onLibraryException', 'onApplicationException', 'onNetworkException'];
	var handlerContext   = 'ctxt';
	var prioritySign     = '+';
	var annotationRegExp = /[\,\s]+([+]?[a-zA-Z_$]{1}[a-zA-Z0-9_$]*)/g;
	var finalParentName  = 'TopNode';

	var generate   = handlerGenerate();
	var transform  = handlerTransform();
	var predefined = handlerPreDefined();


	module.Generate   = generate;
	module.Transform  = transform;
	module.Predefined = predefined;

	module.defined = defined;

	module.handlerMethods   = handlerMethods;
	module.prioritySign     = prioritySign;
	module.handlerUseRegExp = annotationRegExp;
	module.finalParentName  = finalParentName;
	module.handlerContext   = handlerContext;

	return module;
})();