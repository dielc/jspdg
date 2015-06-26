'use strict';

var handlerPreDefined = (function() {
    var module = {};


    var predefined = function() {
    	var logHandler, 
    		bufferHandler, 
    		tryOnceHandler, 
    		noOpHandler, 
    		abortHandler;

    	/* Handler for logging exceptions. */
        logHandler = esprima.parse("var Log = {\
				logger: UniqueLogger.getInstance(),\
					onException: function (call) {\
						this.logger.append('RPC CALL: ' + call.callName + ' ARGS: ' + call.callArgs() + ' ERROR: ' + call.callError);\
						call.proceed();\
					}, \
					onNativeException: function (call) {\
						this.logger.append('RPC CALL: ' + call.callName + ' ARGS ' + call.callArgs() + ' ERROR: ' + call.callError);\
						this.logger.append(call.callError.stack);\
						call.proceed();\
					}\
			}").body[0].declarations[0];
        

        /* Handler for buffering RPCs on relevant exceptions. */
        bufferHandler = esprima.parse("var Buffer = {\
					buffer: UniqueBuffer.getInstance(),\
					onNetworkException: function (call) {\
						var buffer = this.buffer;\
						buffer.bufferCall(call);\
					}\
				}").body[0].declarations[0];


        /* Handler for not retrying RPC on relevant exceptions. */
        tryOnceHandler = esprima.parse("var TryOnce = {\
					onNetworkException: function (call) {\
						call.continue(call.callError, call.callResult);\
					}\
				}").body[0].declarations[0];


        /* Handler that does not do a thing. */
        noOpHandler = esprima.parse("var _noOpHandler = {\
                    onException: function (call) {\
                        call.proceed();\
                    }\
                }").body[0].declarations[0];


        /* Handler that halts the computation. */
        abortHandler = esprima.parse("var Abort = {\
        			onException: function (call) {\
					}\
				}").body[0].declarations[0];
        


        Handler.Transform.handlerDefinition(logHandler);
        Handler.Transform.handlerDefinition(bufferHandler);
        Handler.Transform.handlerDefinition(tryOnceHandler);
        Handler.Transform.handlerDefinition(noOpHandler);
        Handler.Transform.handlerDefinition(abortHandler);

    };

    module.generate = predefined;

    return module;
});