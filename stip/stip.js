var Stip = (function () {

    var module = {};


    /*   _________________________________ PROGRAMS _________________________________
     *
     * https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API#Programs
     */


    var handleProgram = function (graphs, node) {
        var rootnode = new EntryNode(graphs.PDG.entIndex);
        graphs.PDG.changeEntry(rootnode);
        node.body.map(function (exp) {
            makePDGNode(graphs, exp, rootnode);
        })
        return rootnode;
    }


    /*       _________________________________ DECLARATIONS _________________________________
     *
     *  https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API#Declarations
     */

    /* VARIABLE DECLARATION */
    var handleVarDecl = function (graphs, node, upnode) { 
        var stmNodes = [];
        node.declarations.map(function (decl) {
            var stmNode = graphs.PDG.makeStm(decl);
            //pass handlers along
            stmNode.parsenode.handlersAsync = node.handlersAsync;
            if (upnode) 
                stmNode.dtype = upnode.getdtype();
            stmNode.name = decl.id.name;
            addToPDG(stmNode, upnode);
            /* Make (if necessary) PDG nodes of init expression */
            if (decl.init !== null)
                makePDGNode(graphs, decl.init, stmNode);
            graphs.ATP.addNodes(decl, stmNode);
            stmNodes.push(stmNode)
        })
        return stmNodes        
    }

    /* FUNCTION DECLARATION creates a new entry node in the DPDG */
    var handleFuncDeclaration = function (graphs, node, upnode) {
        var PDG       = graphs.PDG,
            entry     = new EntryNode(++graphs.PDG.entIndex, node),
            prevEntry = PDG.entryNode;

        graphs.PDG.changeEntry(entry);
        addToPDG(entry, upnode);
        graphs.ATP.addNodes(node, entry);
        handleFormalParameters(graphs, node, entry);
        

        /* BODY */
        node.body.body.map(function (exp) {
            makePDGNode(graphs, exp, entry)
        })
        /* Exception Exit nodes added along the way should be connected to formal out */
        entry.getFormalOut().map(function (form_out) {
            var returns = form_out.getInEdges()
                            .map(function (e) {return e.from})
                            .filter(function (n) {return esp_isRetStm(n.parsenode)});

            returns.map(function (returnnode) {
                  handleFormalOutParameters(graphs, returnnode, entry, false);
            })
        })

        graphs.PDG.reverseEntry(prevEntry);

        return [entry]
    }

    /* ANONYMOUS FUNCTION DECLARATION bound to a variable
     * creates a entry node and data dependency on the variable */
    var handleAnonFuncDeclaration = function (graphs, node, entry) {
        var func_node = esp_isFunExp(node) ? node : node.declarations[0].init;
        if (Pdg.isConstructor(func_node, graphs.AST)) {
            return handleConstructorFunction(graphs, node, entry);
        }
        var // Statement node of the variable declaration
            stmNode   = graphs.PDG.makeStm(node),
            // Entry node for the function
            entryNode = new EntryNode(graphs.PDG.entIndex, func_node),
            prev_entry = graphs.PDG.entryNode;

        if(node.handlersAsync){
            entryNode.parsenode.handlersAsync = node.handlersAsync.slice();
        }

        graphs.PDG.changeEntry(entryNode);
        graphs.ATP.addNodes(func_node, entryNode);
        handleFormalParameters(graphs,node,entryNode);
        if (!esp_isFunExp(node)) {
            stmNode.addEdgeOut(entryNode, EDGES.DATA);
            graphs.ATP.addNodes(node, stmNode);
            addToPDG(stmNode, entry);
        } 
        else if (entry.isObjectEntry) {
            entry.addMember(node.paramname, entryNode)
        }
        else {
            entry.addEdgeOut(entryNode, EDGES.DATA);
            graphs.ATP.addNodes(node, entry)
        }
        /* BODY */
        func_node.body.body.map(function (exp) {
            makePDGNode(graphs, exp, entryNode)
        })
        /* Exception Exit nodes added along the way should be connected to formal out */
        entryNode.getFormalOut().map(function (form_out) {
            var returns = form_out.getInEdges()
                            .map(function (e) {return e.from})
                            .filter(function (n) {return esp_isRetStm(n.parsenode)});
            returns.map(function (returnnode) {
                  handleFormalOutParameters(graphs, returnnode, entryNode, false);
            })
        })

        graphs.PDG.reverseEntry(prev_entry);
        return [entryNode];        
    }

    var handleConstructorFunction = function (graphs, node, upnode) {
        var stmNode     = graphs.PDG.makeStm(node),
            next_node   = esp_isFunExp(node) ? node : node.declarations[0].init,
            objectEntry = new ObjectEntryNode(graphs.PDG.entIndex++, next_node),
            entryNode   = new EntryNode(++graphs.PDG.entIndex, next_node ),
            prevEntry   = graphs.PDG.entryNode;
        /* declaration of the form var A = function () {} ? */
        if (esp_isVarDecl(node)) {
            addToPDG(stmNode, upnode);
            stmNode.addEdgeOut(objectEntry, EDGES.DATA);
        } else {
            addToPDG(objectEntry, upnode);
        }
        /* Connect function to object entry as constructor */
        addToPDG(entryNode, objectEntry);
        entryNode.isConstructor = true;

        graphs.PDG.changeEntry(entryNode);
        handleFormalParameters(graphs, node, entryNode);
        /* TODO functies moeten aparte object members worden, niet in constructor functie */
        next_node.body.body.map(function (prop) {
            var propNode, parsenode;
            prop.objectentry = objectEntry;
            propNode  = makePDGNode(graphs, prop, entryNode)[0];
            parsenode = propNode.parsenode;
            if (esp_isExpStm(parsenode) && esp_isAssignmentExp(parsenode.expression)) {
                objectEntry.addMember(propNode.name, propNode)
                if (!esp_isFunExp(parsenode.expression.right)) {
                    var fout = new FormalPNode(++graphs.PDG.funIndex, parsenode.expression.left.property.name, -1);
                    addDataDep(propNode, fout);
                    addToPDG(fout, entryNode);
                }
            }
        })
        graphs.PDG.reverseEntry(prevEntry);
        return [objectEntry];
    }

    /* GENERAL FUNCTION for DECLARATIONS */
    var handleDeclarator = function (graphs, node, upnode) {
        var declaratortype = node.type;
        if (!node.declarations || node.declarations[0].init !== null) {
            switch (declaratortype) {
                case 'VariableDeclaration':
                    if (esp_isFunExp(node.declarations[0].init)) 
                        return handleAnonFuncDeclaration(graphs, node, upnode);
                    else 
                        return handleVarDecl(graphs, node, upnode);
                case 'FunctionDeclaration':
                    return handleFuncDeclaration(graphs, node, upnode);
                case 'FunctionExpression':
                    return handleAnonFuncDeclaration(graphs, node, upnode);
            }
        }
        else
            return handleVarDecl(graphs, node, upnode)
    }

    /*        _________________________________ STATEMENTS _________________________________
     *
     *  https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API#Statements
     */


    /* BLOCK STATEMENT:
     * Consists of several statements surrounded by corresponding 
     * push and pop body edges */
    var handleBlockStatement = function (graphs, node, upnode) {
        var PDG       = graphs.PDG,
            old_entry = PDG.entryNode,
            new_entry = new EntryNode(PDG.entIndex, node);

        PDG.entIndex++;
        addToPDG(new_entry, upnode);
        node.body.map(function (exp) {
            makePDGNode(graphs, exp, new_entry); 
        })

        return [new_entry]
    }

    /* IF STATEMENT */
    var handleIfStatement = function (graphs, node, upnode) {
        var PDG        = graphs.PDG,
            consequent = node.consequent,
            alternate  = node.alternate,
            stmNode    = PDG.makeStm(node);
    
        addToPDG(stmNode, upnode);
        /* TEST */
        makePDGNode(graphs, node.test, stmNode);
        /* CONSEQUENT */
        makePDGNode(graphs, consequent, stmNode)
        /* ALTERNATE */
        if (alternate) {
            makePDGNode(graphs, alternate, stmNode)
            stmNode.getOutEdges(EDGES.CONTROL).filter(function (e) {
                if (e.to.parsenode === alternate)
                    e.label = false;
            })
        }
    }


    var handleReturnStatement  = function (graphs, node, upnode) {
        var stmNode = graphs.PDG.makeStm(node),
            formout, pdgnode;

        addToPDG(stmNode, upnode);

        if (node.argument !== null) {
            pdgnode = makePDGNode(graphs, node.argument, stmNode);
            if (pdgnode) {
                pdgnode = pdgnode[0];
                if (pdgnode.isObjectEntry) {
                    formout = handleFormalOutParameters(graphs, pdgnode, graphs.PDG.entryNode, true);
                    pdgnode.addEdgeOut(formout, EDGES.DATA);
                } 
                else {
                    formout = handleFormalOutParameters(graphs, stmNode, graphs.PDG.entryNode, true);
                    stmNode.addEdgeOut(formout, EDGES.DATA);
                } 
            } 
            else {
                formout = handleFormalOutParameters(graphs, stmNode, graphs.PDG.entryNode, true);
                stmNode.addEdgeOut(formout, EDGES.DATA);
            }

        }
        else {
            formout = handleFormalOutParameters(graphs, stmNode, graphs.PDG.entryNode, true);
            stmNode.addEdgeOut(formout, EDGES.DATA);
        }
        
        return [stmNode];    
    }


    var handleForStatement = function (graphs, node, upnode) {
        var stmNode = graphs.PDG.makeStm(node);
        addToPDG(stmNode, upnode);
        stmNode.addEdgeOut(stmNode, EDGES.CONTROL);
        makePDGNode(graphs, node.init, stmNode);
        makePDGNode(graphs, node.test, stmNode);
        makePDGNode(graphs, node.update, stmNode);
        makePDGNode(graphs, node.body, stmNode);
        return [stmNode];
    }


    var handleThrowStatement = function (graphs, node, upnode) {
        var stmNode   = graphs.PDG.makeStm(node),
            entryNode = graphs.PDG.currBodyNode,
            excExit   = graphs.PDG.makeExitNode(node.argument, true);
        upnode.addEdgeOut(stmNode, EDGES.CONTROL);
        stmNode.addEdgeOut(excExit, EDGES.CONTROL);
        entryNode.addExcExit(excExit);
        return [stmNode];
    }

    var handleTryStatement = function (graphs, node, upnode) {
        var stmNode = graphs.PDG.makeStm(node),
            catches = [];
        addToPDG(stmNode, upnode);
        graphs.ATP.addNodes(node, stmNode);
        /* Catch clause */
        node.handlers.map(function (handler) {
            var catchclause = handleCatchClause(graphs, handler, stmNode, upnode.getdtype());
            catches = catches.concat(catchclause);
        })
        stmNode.catches = catches;
        /* Body of try  */
        node.block.body.map(function (bodynode) {
            makePDGNode(graphs, bodynode, stmNode)
        });
        return [stmNode];
    }


    var handleCatchClause = function (graphs, node, upnode, dtype) {
        var stmNode   = graphs.PDG.makeStm(node);
        stmNode.dtype = dtype;
        node.body.body.map(function (bodynode) {
            makePDGNode(graphs, bodynode, stmNode);
        });
        return [stmNode];
    }

    /*       _________________________________ EXPRESSIONS _________________________________
     *
     *  https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API#Expressions
     */

    /* BINARY EXPRESSION  */
    var handleBinExp = function (graphs, node, upnode) {
        var stmNode   = graphs.PDG.makeStm(node),
            parent    = Ast.parent(node, graphs.AST),
            /* returns true for entry node, if stm or for stm as parent */
            hasEntryParent = upnode.isEntryNode ||
                       (upnode.parsenode && (
                       esp_isForStm(upnode.parsenode) || esp_isCatchStm(upnode.parsenode) ||
                       esp_isThrowStm(upnode.parsenode))),
            form_out;

        /* LEFT expression */
        makePDGNode(graphs, node.left, hasEntryParent || upnode.isObjectEntry ? stmNode : upnode);
        /* RIGHT expression */
        makePDGNode(graphs, node.right, hasEntryParent || upnode.isObjectEntry ? stmNode : upnode);
        if (hasEntryParent)
            addToPDG(stmNode, upnode);
        /* upnode that is object entry : special case */
        if (upnode.isObjectEntry)
            upnode.addMember(node.paramname, stmNode)
        return [stmNode];
    }

    var handleNewExp = function (graphs, node, upnode, toadd) {
        var name     = node.callee.name,
            calledf  = Pdg.functionsCalled(node, graphs.AST).values(),
            entry    = graphs.PDG.getEntryNode(calledf[0]),
            proentry = graphs.PDG.makeObjEntry(node),
            fouts    = entry.getFormalOut();
        upnode.addEdgeOut(proentry, EDGES.DATA);
        /* Call to constructor function */
        handleCallExpression(graphs, node, proentry);
        proentry.constructorNode = entry;
        return [proentry];
    }

    /* ASSIGNMENT */
    var handleAssignmentExp = function (graphs, node, upnode) {
        var parsenode    = node.expression,
            ident        = esp_isIdentifier(parsenode.left) ? parsenode.left : parsenode.left.object ,
            stmNode      = graphs.PDG.makeStm(node),
            declaration  = esp_isThisExpression(ident) ? false : Pdg.declarationOf(ident, graphs.AST),
            pdg_nodes    = graphs.ATP.getNode(declaration),
            right;

        stmNode.name = ident.name;
        /* Will add data dependency to declaration node */
        makePDGNode(graphs, parsenode.left, stmNode);
        /* Right-hand side */
        makePDGNode(graphs, parsenode.right, stmNode);
        /* Recheck dependent call nodes for dtype (could be wrong because assign. exp had
           no dtype at that moment ) */
        var calls = stmNode.edges_out.map(function (e) {
            if (e.to.isCallNode && e.equalsType(EDGES.CONTROL))
                e.to.dtype = stmNode.getdtype()
        })
        addToPDG(stmNode, upnode);
        return [stmNode];
    }

    /* ARRAY EXPRESSION */
    var handleArrayExpression = function (graphs, node, upnode) {
        var stmNode   = graphs.PDG.makeStm(node),
            parent    = Ast.parent(node, graphs.AST),
            /* returns true for entry node, if stm or for stm as parent */
            hasEntryParent = upnode.isEntryNode ||
                       esp_isIfStm(upnode.parsenode) ||
                       esp_isForStm(upnode.parsenode),
            form_out;

        /* ELEMENTS */
        node.elements.map(function (el) {
            makePDGNode(graphs, el, hasEntryParent || upnode.isObjectEntry ? stmNode : upnode)
        })
        if (hasEntryParent)
            addToPDG(stmNode, upnode);
        if (upnode.isObjectEntry)
            upnode.addMember(node.paramname, stmNode)
        return [stmNode];
    }

    /* MEMBER EXPRESSION */
    var handleMemberExpression = function (graphs, node, upnode) {
        var parsenode = node.expression ? node.expression : node,
            object   = parsenode.object, 
            property = parsenode.property,
            stmNode  = graphs.PDG.makeStm(node),
            /* returns true for entry node, if stm or for stm as parent */
            hasEntryParent = upnode.isEntryNode ||
                       esp_isIfStm(upnode.parsenode) ||
                       esp_isForStm(upnode.parsenode);
        if (hasEntryParent)
            addToPDG(stmNode, upnode);
        /* Object : this - reference to object */
        if (esp_isIdentifier(object)) {
            var decl        = Pdg.declarationOf(object, graphs.AST), 
                PDGnode     = graphs.ATP.getNode(decl),
                handle = function (declarationNode) {
                    var objectentry = declarationNode, 
                        member;
                    if (declarationNode)
                        if (declarationNode.isStatementNode && 
                            esp_isVarDeclarator(declarationNode.parsenode)) {

                         objectentry = declarationNode.getOutEdges(EDGES.DATA)
                                        .map(function (e) {return e.to})
                                        .filter(function (n) {return n.isObjectEntry})[0]
                        } 

                        member = objectentry.getMember(property);
                        if (member)
                            addDataDep(member, hasEntryParent ? stmNode : upnode);
                        else {
                            var constructor  = objectentry.constructorNode,
                            cobjectentry = constructor.getInEdges(EDGES.OBJMEMBER)
                                        .map(function (e) {return e.from})
                                        .filter(function (n) {return n.isObjectEntry})[0],
                            memberstm    = cobjectentry.getMember(property);
                            addDataDep(memberstm, upnode);
                        }
                };

            if (PDGnode) {
                handle(PDGnode[0])
            } else {
                graphs.ATP.installListener(decl, handle);
            }
            

        } else if (esp_isExpStm(upnode.parsenode) && esp_isAssignmentExp(upnode.parsenode.expression)) {
            upnode.name = property.name;
            /* Currently handling constructor function */
            if (graphs.PDG.entryNode.isConstructor) {
                var formp = graphs.PDG.entryNode.getFormalIn()
                            .filter( function (f) {
                                return f.name === node.name
                        });
                formp.map(function (f_in) {
                    addDataDep(f_in, upnode)
                })
            }
        }
        else if (esp_isThisExpression(object)) {
            var objectentry = upnode.enclosingObjectEntry(),
                memberstm   = objectentry ? objectentry.getMember(property) : false;
            if (memberstm) 
                memberstm.addEdgeOut(upnode, EDGES.DATA);
        }
        /* Will add data dependency to declaration node */
        //makePDGNode(graphs, object, hasEntryParent ? stmNode : upnode);
        /* Right-hand side */
        //makePDGNode(graphs, property, hasEntryParent ? stmNode : upnode);
        /* Recheck dependent call nodes for dtype (could be wrong because assign. exp had
           no dtype at that moment ) */
        var calls = stmNode.edges_out.map(function (e) {
            if (e.to.isCallNode && e.equalsType(EDGES.CONTROL))
                e.to.dtype = stmNode.getdtype()
        });
        return [stmNode];
    }

    /* PROPERTY */
    var handleProperty = function (graphs, node, upnode) {
        var stmNode = graphs.PDG.makeStm(node);
        upnode.addMember(node.key.name, stmNode)
        makePDGNode(graphs, node.value, stmNode);
        return [stmNode];
    }


    /* THIS EXPRESSION */
    var handleThisExpression = function (graphs, node, upnode) {
        Ast.enclosingScope;
    }


    var handleObjectExpression = function (graphs, node, upnode) {
        var objectEntry = new ObjectEntryNode(graphs.PDG.entIndex++, node),
            prevEntry   = graphs.PDG.entryNode;
        graphs.PDG.changeEntry(objectEntry);
        if (esp_isVarDeclarator(upnode.parsenode))
            addDataDep(upnode, objectEntry)
        else
            addToPDG(objectEntry, upnode);
        node.properties.map(function (prop) {
            makePDGNode(graphs, prop, objectEntry)
        })
        graphs.PDG.reverseEntry(prevEntry);
        return [objectEntry];
    }

    /* CALL EXPRESSION */
    var handleCallExpression = function (graphs, node, upnode) {
        // Handle actual parameters of this call
        var callcnt   = ++cnt,
            parsenode = node.expression ? node.expression : node,
            primitive = graphs.ATP.isPrimitive(parsenode.callee),
            callnode  = graphs.PDG.makeCall(node);

        if(parsenode !== node)
            parsenode.handlersAsync = node.handlersAsync;    
        
        callnode.name = parsenode.callee.toString();
        if (primitive) {
            upnode.primitive = true;
        }
        // Callee = member expression en de left hand side, declaration = primitive set
        /*
         *  TODO
         */
        if (esp_isMemberExpression(parsenode.callee)) {
             var declaration = Pdg.declarationOf(parsenode.callee.object, graphs.AST),
                 PDG_node = graphs.ATP.getNode(declaration),
                 handle = function (pdgnode) {
                    var hasEntryParent = upnode.isEntryNode ||
                               (upnode.parsenode && (esp_isIfStm(upnode.parsenode) ||
                               esp_isForStm(upnode.parsenode) || esp_isCatchStm(upnode.parsenode) ||
                               esp_isThrowStm(upnode.parsenode)));
                    //if (pdgnode.primitive) {
                        var calledname = esp_getCalledName(parsenode);
                        var objectentry = pdgnode.getOutEdges(EDGES.DATA)
                                            .map(function (e) {return e.to})
                                            .filter(function (n) {return n.isObjectEntry})[0];
                        callnode.name = calledname;
                        if (objectentry) {
                            /* Get object property */
                            var member = objectentry.getMember(calledname);
                            var entry  = member ? member.getOutEdges(EDGES.DATA)
                                            .map(function (e) {return e.to})
                                            .filter(function (n) {return n.isEntryNode})[0] : false;
                            if (entry)
                                addCallDep(callnode, entry)
                        //}

                        upnode.addEdgeOut(callnode, EDGES.CONTROL);
                        handleActualParameters(graphs, parsenode, callnode);
                        if (!hasEntryParent) {
                            pdgnode.addEdgeOut(upnode, EDGES.DATA)
                        } else {
                            pdgnode.addEdgeOut(callnode, EDGES.DATA)
                        }
                    };
                return [callnode]
            }
            if (PDG_node)
                return handle(PDG_node[0])
            else {
                graphs.ATP.installListener(declaration, handle) 
                return [callnode];
            }
        }
        var preventry = graphs.PDG.entryNode,
            calledf   = Pdg.functionsCalled(node, graphs.AST).values(),
            entry     = calledf.length > 0 ? graphs.PDG.getEntryNode(calledf[0]) : false, 
            handle    =  function (entrynode) {
                var formals = entrynode.getFormalIn();
                if (!callnode.name.startsWith('anonf')) {
                addToPDG(callnode, upnode);
                addCallDep(callnode, entrynode);
                handleActualParameters(graphs, parsenode, callnode);
                /* Bind the actual and formal parameters */
                for (var i = 0; i < callnode.getActualIn().length; i++) {
                    var a = callnode.getActualIn()[i],
                        f = formals[i];
                    /* actual-in parameter -> formal-in parameter */
                    if (f && (!a.equalsdtype(f) || 
                        !a.isSharedNode() ||
                        !f.isSharedNode()))
                        a.addEdgeOut(f, EDGES.REMOTEPARIN)
                    else if (f)
                        a.addEdgeOut(f, EDGES.PARIN);
                }
                /* Actual out parameter */
                if (entrynode.excExits.length > 0) {
                    /* Call made in try/catch statement? */
                    handleCallwithCatch(graphs, callnode, entrynode, upnode)
                }
                //else if (!name.startsWith('anonf')) {
                    entrynode.getFormalOut().map(function (formal_out) {
                        var actual_out = new ActualPNode(graphs.PDG.funIndex, -1),
                            upnodeform = formal_out.getInEdges(EDGES.DATA)
                                            .map(function (e) {return e.from})
                                            .filter(function (n) {return n.isObjectEntry});
                        if (!upnode.isEntryNode && !upnode.isObjectEntry)
                            addDataDep(actual_out, upnode)
                        else if (!upnode.isObjectEntry)
                            addDataDep(actual_out, callnode)
                        /* Connect upnode to object entry that is returned by function */
                        if (upnodeform.length > 0) {
                            upnodeform.map(function (objectentry) {
                                addDataDep(upnode, objectentry)
                            })
                        }    

                        /* Formal-out parameter -> actual-out parameter */
                        if (formal_out && (!actual_out.equalsdtype(formal_out) || 
                            !actual_out.isSharedNode() ||
                            !formal_out.isSharedNode () ))
                                formal_out.addEdgeOut(actual_out, EDGES.REMOTEPAROUT); 
                        else if (formal_out)
                            formal_out.addEdgeOut(actual_out, EDGES.PAROUT);
                        callnode.addEdgeOut(actual_out, EDGES.CONTROL);  
                    })

                }
                /* Add summary edges between a_in and a_out */
                handleSummaryEdges(callnode, entrynode);
                postRemoteDep(callnode.getActualIn());

                if(!callnode.name.startsWith('anonf'))
                    entrynode.addCall(callnode);
                return [callnode]
            };

        if (entry)
            return handle(entry)
        else {
            graphs.ATP.installListener(calledf[0], handle)    
            return [callnode]
        }
            
       
    }

    /* ACTUAL PARAMETERS of a function call.
     * All parameters are bundled by operand continuation edges */
    var handleActualParameters = function (graphs, node, callnode) {
        var nr_param   = node.arguments.length,
            params     = node.arguments,
            curr_param = 0,
            a_in;
        while (nr_param != curr_param) {
            a_in = new ActualPNode(graphs.PDG.funIndex, 1);
            graphs.PDG.funIndex++;
            a_in.parsenode = params[curr_param];

            //pass handlers along!
            a_in.parsenode.handlersAsync = callnode.parsenode.handlersAsync;

            var PDG_node = makePDGNode(graphs, a_in.parsenode, a_in);
            curr_param++;
            callnode.addEdgeOut(a_in, EDGES.CONTROL);
        }
    }

    var handleCallwithCatch = function (graphs, callnode, entrynode, upnode) {
        var excExits   = entrynode.excExits,
            trystm     = esp_inTryStatement(graphs.AST, callnode.parsenode),
            form_outs  = entrynode.getFormalOut().filter(function (f_out) {
                return f_out.getInEdges().filter(function (e) {
                    return e.from.isExitNode && !e.from.exception
                }).length > 0
            }),
            normalExit = graphs.PDG.makeExitNode(undefined, false),
            toUpnode   = function (actual_out) {
                  if (!upnode.isEntryNode || upnode.isObjectEntry)
                    addDataDep(actual_out, upnode)
                  else
                    addDataDep(actual_out, callnode)
                },
            trynode, a_out;

        excExits.map(function (excExit) {
            var form_out = excExit.getOutEdges()
                            .map(function (e) {return e.to})
                            .filter(function (n) {return n.isFormalNode})[0];
            if (esp_isTryStm(trystm) && excExit.exception) {
                trynode = graphs.ATP.getNode(trystm)[0];
                if (trynode && trynode.catches) {
                    trynode.catches.map(function (catchnode) {
                        a_out = new ActualPNode(++graphs.PDG.funIndex, -1);
                        addToPDG(catchnode, callnode);
                        catchnode.addEdgeOut(a_out, EDGES.CONTROL);
                        form_out.addEdgeOut(a_out, EDGES.PAROUT); // TODO remote par out as well
                        toUpnode(a_out);
                    })
                }
            }
        })
        a_out = new ActualPNode(++graphs.PDG.funIndex, -1);
        normalExit.addEdgeOut(a_out, EDGES.CONTROL);
        form_outs[0].addEdgeOut(a_out, EDGES.PAROUT);
        callnode.addEdgeOut(normalExit, EDGES.CONTROL);
        toUpnode(a_out);
    }

    /* FORMAL PARAMETERS of a function definition.
     * This is handled on AST level (parsenode.params) */
    var handleFormalParameters = function (graphs, node, entry) {
        var nr_params = entry.parsenode.params.length,
            PDG       = graphs.PDG,
            params    = entry.parsenode.params;
        for (var i = 0; i < nr_params; i++) {
            var param    = params[i],
                fin_node = graphs.PDG.makeFormalNode(param.name, 1);
            entry.addEdgeOut(fin_node, EDGES.CONTROL); 
        }
    }

    /* Function is called :
     * 1. When formal_out parameter should be added (e.g. return statement)
     * 2. When function has been evaluated and there were throw statements in there
     *    In this case this function makes the former formal_out parameter a normal exit out parameter.
     */
    var handleFormalOutParameters = function (graphs, stmNode, entry, recheck) {
        var PDG      = graphs.PDG,
            form_out = graphs.PDG.makeFormalNode(stmNode.parsenode, -1),
            normalExit;
        /* If function has throw statements, normal exit node should  be added 
           + formal out for every exception exit node as well */
        if (entry.excExits.length > 0 && !recheck) {
            entry.excExits.map(function (excExit) {
                var form_out = graphs.PDG.makeFormalNode(excExit.parsenode, -1);
                excExit.addEdgeOut(form_out, EDGES.CONTROL);
            })
            /* If recheck, remove old formal_out parameter */
            stmNode.edges_out = stmNode.edges_out.filter(function (e) {
                return e.equalsType(EDGES.CONTROL) && !e.to.isFormalNode 
            })
            normalExit = graphs.PDG.makeExitNode(stmNode.parsenode, false);
            normalExit.addEdgeOut(form_out, EDGES.CONTROL);
            entry.excExits.push(normalExit);
            stmNode.addEdgeOut(normalExit, EDGES.CONTROL);
            entry.edges_out = entry.getOutEdges()
                                .filter(function (e) {
                                    return !(e.to.isFormalNode && e.to.direction < 0)
                                })
        }
        else if (recheck)
            entry.addEdgeOut(form_out, EDGES.CONTROL);
        return form_out;
    }

    /* Formal out nodes in a constructor function represent properties in the object.
       They are not responsible for handling the value expression, but should however
       contain a data dependency to the formal_in parameters if these are being referenced */
    var handleFormalParamObj = function (entry, formalParam) {
        var value = escodegen.generate(formalParam.parsenode),
            fins  = entry.getFormalIn();
        falafel(value, function (node) {
            if (esp_isIdentifier(node)) {
              fins.map(function (fin) {
                if (fin.name === node.name) 
                    addDataDep(fin, formalParam);
                })
            }
        })
    }

    /* Summary edges are added between actual_in to actual_out parameter if
     * a path between the corresponding formal_in to formal_out exists */
    var handleSummaryEdges = function (callnode, entryNode) {
        var actual_ins = callnode.getActualIn(),
            actual_outs = callnode.getActualOut(),
            formal_ins = entryNode.getFormalIn(),
            formal_outs = entryNode.getFormalOut();
        if(actual_outs && formal_outs) {
            for(var i = 0; i < actual_ins.length; i++) {
                var actual_in  = actual_ins[i],
                    actual_out = actual_outs[i] ? actual_outs[i] : actual_outs[0],
                    formal_in  = formal_ins[i],
                    /* Normal function -> 1 formal out, constructor function -> [0..*] formal outs */
                    formal_out = formal_outs[i] ? formal_outs[i] : formal_outs[0];
                if(formal_in && formal_out && formal_in.pathExistsTo(formal_out)) {
                    actual_in.addEdgeOut(actual_out, EDGES.SUMMARY)
                }
            }
        }
    }

    /* GENERAL FUNCTION for EXPRESSIONS */
    var handleExpressionStatement = function (graphs, node, upnode) {
        var expressiontype = node.expression ? node.expression.type : node.type;
        switch (expressiontype) {
            case 'CallExpression':
                return handleCallExpression(graphs, node, upnode);
            case 'BinaryExpression' :
                return handleBinExp(graphs, node.expression ? node.expression : node, upnode);
            case 'AssignmentExpression' :
                return handleAssignmentExp(graphs, node, upnode);
            case 'ArrayExpression' :
                return handleArrayExpression(graphs, node, upnode);
            case 'MemberExpression' :
                return handleMemberExpression(graphs, node, upnode);
            case 'ThisExpression' :
                return handleThisExpression(graphs, node, upnode);
            case 'NewExpression' :
                return handleNewExp(graphs, node, upnode);
            case 'Property' :
                return handleProperty(graphs, node, upnode);
            case 'ObjectExpression' :
                return handleObjectExpression(graphs, node, upnode)
         }
    }

    var handleIdentifier = function (graphs, node, upnode) {
        var parent      = Ast.parent(node, graphs.AST),
            formp       = graphs.PDG.entryNode.getFormalIn(),
            isPrimitive = graphs.ATP.isPrimitive(node),
            declaration;
        if (!isPrimitive) {
            // SHOULD RETURN ALL DECLARATIONS OF...
            declaration = Pdg.declarationOf(node, graphs.AST);
            if (declaration) {
            var PDG_nodes = graphs.ATP.getNode(declaration);
                if (PDG_nodes && PDG_nodes.length > 0 && upnode) 
                    PDG_nodes.map( function (vardecl) {
                        addDataDep(vardecl, upnode)
                    })
            }   
            formp = formp.filter( function (f) {
                return f.name === node.name;
            });
            formp.map(function (f_in) {
                addDataDep(f_in, upnode)
            })
        }

    }

    var handleLiteral = function (graphs, node, upnode) {
        var parent    = Ast.parent(node, graphs.AST);
        if (parent && esp_isRetStm(parent)) {
            var stmNode = graphs.PDG.makeStm(parent);
            upnode.addEdgeOut(stmNode, EDGES.CONTROL);
            return [stmNode];
        }
        if (parent && esp_isAssignmentExp(parent) && upnode.isObjectEntry) {
            var stmNode = graphs.PDG.makeStm(node);
            upnode.addEdgeOut(stmNode, EDGES.OBJMEMBER);
            upnode.addMember(parent.left.property, stmNode);
            return [stmNode];
        }
    }


    /* Auxiliary Functions to add correct edges to nodes, etc. */
    var addToPDG = function (node, upnode) {
        var comment;
        if (node.parsenode && 
            esp_isBlockStm(node.parsenode) && 
            Comments.isTierAnnotated(node.parsenode)) { 

            comment = node.parsenode.leadingComment;
            if (Comments.isClientAnnotated(comment)) 
                graphs.PDG.addClientStm(node)
            else if (Comments.isServerAnnotated(comment))
                graphs.PDG.addServerStm(node)
        }

        /* Block with tier annotation is handled separately */
        else {
            if (upnode.isObjectEntry)
                upnode.addEdgeOut(node, EDGES.OBJMEMBER)
            else
                upnode.addEdgeOut(node, EDGES.CONTROL)
        }
    }

    var addCallDep = function (from, to) {
        var dtypef = from.getdtype(),
            dtypet = to.getdtype();
        if (dtypef && dtypet)
            if(dtypef.value === DNODES.SHARED.value ||
                dtypet.value === DNODES.SHARED.value) 
                from.addEdgeOut(to, EDGES.CALL)
            else if (dtypef.value !== dtypet.value) 
                from.addEdgeOut(to, EDGES.REMOTEC)
            else 
                from.addEdgeOut(to, EDGES.CALL)
            if (dtypef.value === DNODES.SERVER &&
                dtypet.value === DNODES.CLIENT)
                to.clientCalls += 1;
            else if (dtypef.value === DNODES.CLIENT &&
                dtypet.value === DNODES.SERVER) 
                to.clientCalls += 1;
        else
            from.addEdgeOut(to, EDGES.CALL)
    }

    var addDataDep = function (from, to) {
        var dtypef = from.getdtype(),
            dtypet = to.getdtype(),
            dupl   = from.getOutEdges(EDGES.REMOTED)
                         .concat(from.getOutEdges(EDGES.DATA))
                         .filter(function (e) {
                            return  e.to.equals(to) });
        if(dupl.length < 1) {
            if(dtypef && dtypet && 
                (dtypef.value !== DNODES.SHARED.value &&
                 dtypet.value !== DNODES.SHARED.value) &&
                 dtypef.value !== dtypet.value) 
                from.addEdgeOut(to, EDGES.REMOTED)
            else
                from.addEdgeOut(to, EDGES.DATA)
        }
    }

    /*
     * Because actual parameters are handled before the actual call node,
     * some dependencies for these parameters can be wrong 
     * (atm of creating them the actual parameters don't know their tier information)
     * This function rechecks them.
     */
    var postRemoteDep = function (params) {
        params.map( function (param) {
            var datadeps = param.getInEdges(EDGES.DATA)
                                .concat(param.getInEdges(EDGES.REMOTED)),
                calldeps = param.getInEdges().filter( function (e) {
                    return e.from.isCallNode  
                }).map( function (e) { return e.from});

            var paramtype = param.getdtype(true);   

            datadeps.map(function (e) {
                var dtypef = e.from.getdtype(true);
                if(dtypef && paramtype && 
                   (dtypef.value !== DNODES.SHARED.value &&
                    paramtype.value !== DNODES.SHARED.value) && 
                    dtypef.value !== paramtype.value)
                    e.type = EDGES.REMOTED;
                else
                    e.type = EDGES.DATA;
            })

            calldeps.map(function (n) {
                 n.getOutEdges(EDGES.CALL).concat(n.getOutEdges(EDGES.REMOTEC))
                  .map( function (e) {
                    var dtypet = e.to.getdtype(true),
                        dtypef = e.from.getdtype(true);
                    if(dtypef && dtypet) {
                        if(dtypef.value === DNODES.SHARED.value ||
                           dtypet.value === DNODES.SHARED.value) 
                              e.type = EDGES.CALL;
                        else if (dtypef.value !== dtypet.value) 
                              e.type = EDGES.REMOTEC;
                        else 
                           e.type =  EDGES.CALL;
                    }
                });

                /* perform post check recursively! */
               // var a_ins = n.getActualIn();
                //postRemoteDep(a_ins);
            })
        })
    }

    /* make PDG node out of an AST node:
     * graphs = object containing different graphs,
     * node   = AST node
     * upnode = direct 'upnode' of ent node, e.g. 'return x'-node for the 'x'-node
     */
    var makePDGNode = function (graphs, node, upnode) {
        var PDG = graphs.PDG,
            jtc = graphs.JTC,
            parsetype = node.type,
            pdgnode;
            console.log("PDG(" + parsetype + ")" + node);

        if(upnode && upnode.parsenode && upnode.parsenode.handlersAsync){
            node.handlersAsync = upnode.parsenode.handlersAsync.slice();
        }else{
            node.handlersAsync = [];
        }        

        if (node.leadingComment) {
            Comments.handleBeforeComment(node.leadingComment, node, upnode)
        }

        switch (parsetype) {
            case 'Program':
                pdgnode = handleProgram(graphs, node);
                break;
            case 'FunctionDeclaration': 
                pdgnode = handleDeclarator(graphs, node, upnode);
                break;
            case 'VariableDeclaration':
                pdgnode = handleDeclarator(graphs, node, upnode);
                break;
            case 'FunctionExpression' :
                pdgnode = handleDeclarator(graphs, node, upnode);
                break;
            case 'BlockStatement' :
                pdgnode = handleBlockStatement(graphs, node, upnode);
                break;
            case 'IfStatement' :
                pdgnode = handleIfStatement(graphs, node, upnode);
                break;
            case 'ForStatement' :
                pdgnode =handleForStatement(graphs, node, upnode);
                break;
            case 'Identifier' :
                pdgnode = handleIdentifier(graphs, node, upnode);
                break;
            case 'ExpressionStatement' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'BinaryExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'Literal' :
                pdgnode = handleLiteral(graphs, node, upnode);
                break;
            case 'CallExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'AssignmentExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'ArrayExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'ObjectExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'MemberExpression' :
                pdgnode = handleMemberExpression(graphs, node, upnode);
                break;
            case 'Property' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'ReturnStatement' :
                pdgnode = handleReturnStatement(graphs, node, upnode);
                break;
            case 'ThisExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'NewExpression' :
                pdgnode = handleExpressionStatement(graphs, node, upnode);
                break;
            case 'ThrowStatement' :
                pdgnode = handleThrowStatement(graphs, node, upnode);
                break;
            case 'TryStatement' :
                pdgnode = handleTryStatement(graphs, node, upnode);
                break;
            case 'CatchClause' :
                pdgnode = handleCatchClause(graphs, node, upnode);
                break;
        }

        if (node.leadingComment) {
            Comments.handleAfterComment(node.leadingComment, pdgnode, upnode)
        }

        return pdgnode
    }


    /* Graph */
    function ASTToPDGMap () {
        this._nodes = HashMap.empty(131);
        this.listeners = {};
    }

    ASTToPDGMap.prototype.putNodes = function (AstNode, PDGNode) {
        this._nodes = this._nodes.put(AstNode,PDGNode);
    }

    ASTToPDGMap.prototype.addNodes = function (AstNode, PDGNode) {
        var prev = this._nodes.get(AstNode, ArraySet.empty()),
            add  = prev ?  prev.concat(PDGNode) : [PDGNode];
        this._nodes = this._nodes.put(AstNode, add);
        if (this.listeners[AstNode])
            this.listeners[AstNode].map(function (listener) {
                listener(PDGNode)
            })
    }

    ASTToPDGMap.prototype.getNode = function (AstNode) {
        var emptySet = ArraySet.empty(),
            res      = this._nodes.get(AstNode, emptySet);
        return res;
    }

    ASTToPDGMap.prototype.isPrimitive = function (identifier) {
        return this.primitives.indexOf(identifier.name) >= 0;
    }

    ASTToPDGMap.prototype.installListener = function (AstNode, listener) {
        if (this.listeners[AstNode])
            this.listeners[AstNode].push(listener)
        else 
            this.listeners[AstNode] = [listener]
    }

    function Graphs (AST, src, primitives) {
        this.AST            = AST;
        this.PDG            = new PDG();
        this.ATP            = new ASTToPDGMap();
        this.src            = src;
        this.ATP.primitives = primitives;
    }

    /* Create the program dependency graph */
    start = function (graphs) {
        makePDGNode(graphs, graphs.AST);
    }

    module.start = start;
    module.Graphs = Graphs;
    return module;

})();