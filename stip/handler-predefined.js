'use strict';

var handlerPreDefined = (function () {
	var module             = {};
	var predefinedHandlers = {};
	var handler, transformedHandler;

	var predefined = function () {
		handler = esprima.parse("var Log = {\
				logger: UniqueLogger.getInstance(), \
					onException: function (call) {\
						this.logger.append('RPC CALL: ' + call.callName + ' ARGS: ' + call.callArgs() + ' ERROR: ' + call.callError);\
					}, \
					onNativeException: function (call) {\
						this.logger.append('RPC CALL: ' + call.callName + ' ARGS ' + call.callArgs() + ' ERROR: ' + call.callError);\
						this.logger.append(call.callError.stack);\
					}\
			}").body[0].declarations[0];
		transformedHandler = Handler.Transform.extractHandler(handler);
		predefinedHandlers[transformedHandler.name] = transformedHandler.handlerMaker;



		handler = esprima.parse("var Buffer = {\
					buffer: UniqueBuffer.getInstance(),\
					onNetworkException: function (call) {\
						var buffer = this.buffer;\
						buffer.bufferCall(call);\
					}\
				}").body[0].declarations[0];
		transformedHandler = Handler.Transform.extractHandler(handler);
		predefinedHandlers[transformedHandler.name] = transformedHandler.handlerMaker;



		handler = esprima.parse("var TryOnce = {\
					onNetworkException: function () {}\
				}").body[0].declarations[0];
		transformedHandler = Handler.Transform.extractHandler(handler);
		predefinedHandlers[transformedHandler.name] = transformedHandler.handlerMaker;


		handler = esprima.parse("var _noOpHandler = {}").body[0].declarations[0];
		transformedHandler = Handler.Transform.extractHandler(handler);
		predefinedHandlers[transformedHandler.name] = transformedHandler.handlerMaker;

		return predefinedHandlers;
	};



	module.predefinedHandlers = predefined;

	return module;
});