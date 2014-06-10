/**!
 * @preserve
 */
YUI.add( 'perturbatio-tooltip', function ( Y ) {
	var Lang = Y.Lang,
		Node = Y.Node,
		OX = -10000,
		OY = -10000;
	"use strict";

	var P = Y.namespace( 'Perturbatio' );

	P.Tooltip = Y.Base.create( "perturbatio-tooltip", Y.Widget, [
		Y.WidgetPosition,
		Y.WidgetStack,
		Y.WidgetPositionAlign,
		Y.WidgetPositionConstrain
	], {

		// PROTOTYPE METHODS/PROPERTIES

		/*
		 * Initialization Code: Sets up privately used state
		 * properties, and publishes the events Tooltip introduces
		 */
		initializer         : function ( config ) {
			var widget = this;

			widget._triggerClassName = widget.getClassName( "trigger" );

			// Currently bound trigger node information
			widget._currTrigger = {
				node  : null,
				title : null,
				mouseX: P.Tooltip.OFFSCREEN_X,
				mouseY: P.Tooltip.OFFSCREEN_Y
			};

			// Event handles - mouse over is set on the delegate
			// element, mousemove and mouseleave are set on the trigger node
			widget._eventHandles = {
				delegate: null,
				trigger : {
					mouseMove: null,
					mouseOut : null
				}
			};

			// Show/hide timers
			widget._timers = {
				show: null,
				hide: null
			};

			// Publish events introduced by P.Tooltip. Note the triggerEnter event is preventable,
			// with the default behavior defined in the _defTriggerEnterFn method
			widget.publish( "triggerEnter", {defaultFn: widget._defTriggerEnterFn, preventable: true} );
			widget.publish( "triggerLeave", {preventable: false} );
		},

		/*
		 * Destruction Code: Clears event handles, timers,
		 * and current trigger information
		 */
		destructor          : function () {
			var widget = this;
			widget._clearCurrentTrigger();
			widget._clearTimers();
			widget._clearHandles();
		},

		/*
		 * bindUI is used to bind attribute change and dom event
		 * listeners
		 */
		bindUI              : function () {
			var widget = this;
			widget.after( "delegateChange", widget._afterSetDelegate );
			widget.after( "nodesChange", widget._afterSetNodes );

			widget._bindDelegate();
		},

		/*
		 * syncUI is used to update the rendered DOM, based on the current
		 * Tooltip state
		 */
		syncUI              : function () {
			var widget = this;
			widget._uiSetNodes( widget.get( "triggerNodes" ) );
		},

		/*
		 * Public method, which can be used by triggerEvent event listeners
		 * to set the content of the tooltip for the current trigger node
		 */
		setTriggerContent   : function ( content ) {
			var contentBox = this.get( "contentBox" );
			contentBox.set( "innerHTML", "" );

			if ( content ) {
				if ( content instanceof Node ) {
					for ( var i = 0, l = content.size(); i < l; ++i ) {
						contentBox.appendChild( content.item( i ) );
					}
				} else if ( Lang.isString( content ) ) {
					contentBox.set( "innerHTML", content );
				}
			}
		},

		/*
		 * Default attribute change listener for
		 * the triggerNodes attribute
		 */
		_afterSetNodes      : function ( e ) {
			this._uiSetNodes( e.newVal );
		},

		/*
		 * Default attribute change listener for
		 * the delegate attribute
		 */
		_afterSetDelegate   : function ( e ) {
			this._bindDelegate( e.newVal );
		},

		/*
		 * Updates the rendered DOM to reflect the
		 * set of trigger nodes passed in
		 */
		_uiSetNodes         : function ( nodes ) {
			var widget = this;

			if ( widget._triggerNodes ) {
				widget._triggerNodes.removeClass( widget._triggerClassName );
			}

			if ( nodes ) {
				widget._triggerNodes = nodes;
				widget._triggerNodes.addClass( widget._triggerClassName );
			}
		},

		/*
		 * Attaches the default mouseover DOM listener to the
		 * current delegate node
		 */
		_bindDelegate       : function () {
			var widget = this,
				eventHandles = widget._eventHandles;

			if ( eventHandles.delegate ) {
				eventHandles.delegate.detach();
				eventHandles.delegate = null;
			}
			eventHandles.delegate = Y.delegate( "mouseenter", Y.bind( widget._onNodeMouseEnter, widget ), widget.get( "delegate" ), "." + widget._triggerClassName );
		},

		/*
		 * Default mouse enter DOM event listener.
		 *
		 * Delegates to the _enterTrigger method,
		 * if the mouseover enters a trigger node.
		 */
		_onNodeMouseEnter   : function ( e ) {
			var widget = this,
				node = e.currentTarget;
			if ( node && (!widget._currTrigger.node || !node.compareTo( widget._currTrigger.node )) ) {
				widget._enterTrigger( node, e.pageX, e.pageY );
			}
		},

		/*
		 * Default mouse leave DOM event listener
		 *
		 * Delegates to _leaveTrigger if the mouse
		 * leaves the current trigger node
		 */
		_onNodeMouseLeave   : function ( e ) {
			this._leaveTrigger( e.currentTarget );
		},

		/*
		 * Default mouse move DOM event listener
		 */
		_onNodeMouseMove    : function ( e ) {
			this._overTrigger( e.pageX, e.pageY );
		},

		/*
		 * Default handler invoked when the mouse enters
		 * a trigger node. Fires the triggerEnter
		 * event which can be prevented by listeners to
		 * stop the tooltip from being displayed.
		 */
		_enterTrigger       : function ( node, x, y ) {
			var widget = this;
			widget._setCurrentTrigger( node, x, y );
			widget.fire( "triggerEnter", {node: node, pageX: x, pageY: y} );
		},

		/*
		 * Default handler for the triggerEvent event,
		 * which will setup the timer to display the tooltip,
		 * if the default handler has not been prevented.
		 */
		_defTriggerEnterFn  : function ( e ) {
			var widget = this,
				node = e.node;
			if ( !widget.get( "disabled" ) ) {
				widget._clearTimers();
				var delay = (widget.get( "visible" )) ? 0 : widget.get( "showDelay" );
				widget._timers.show = Y.later( delay, widget, widget._showTooltip, [node] );
			}
		},

		/*
		 * Default handler invoked when the mouse leaves
		 * the current trigger node. Fires the triggerLeave
		 * event and sets up the hide timer
		 */
		_leaveTrigger       : function ( node ) {
			var widget = this;
			widget.fire( "triggerLeave" );

			widget._clearCurrentTrigger();
			widget._clearTimers();

			widget._timers.hide = Y.later( widget.get( "hideDelay" ), widget, widget._hideTooltip );
		},

		/*
		 * Default handler invoked for mousemove events
		 * on the trigger node. Stores the current mouse
		 * x, y positions
		 */
		_overTrigger        : function ( x, y ) {
			var widget = this;
			widget._currTrigger.mouseX = x;
			widget._currTrigger.mouseY = y;
		},

		/*
		 * Shows the tooltip, after moving it to the current mouse
		 * position.
		 */
		_showTooltip        : function ( node ) {
			var x, y, offsetX, offsetY,
				calcX, calcY,
				widget = this;

			x = widget._currTrigger.mouseX;
			y = widget._currTrigger.mouseY;

			calcX = widget.get( 'calcX' );
			calcY = widget.get( 'calcY' );

			offsetX = widget.get( 'offsetX' );
			offsetY = widget.get( 'offsetY' );

			if ( typeof offsetX === 'function' ) {
				offsetX = offsetX.apply( widget, [node, x] );
			}
			if ( typeof offsetY === 'function' ) {
				offsetY = offsetY.apply( widget, [node, y] );
			}
			if ( typeof calcX === 'function' ) {
				x = calcX.apply( widget, [node, x] );
			}
			if ( typeof calcY === 'function' ) {
				y = calcY.apply( widget, [node, y] );
			}

			widget.move( x + offsetX, y + offsetY );

			widget.show();
			widget._clearTimers();

			if ( widget.get( 'autoHide' ) ) {
				widget._timers.hide = Y.later( widget.get( "autoHideDelay" ), widget, widget._hideTooltip );
			}
		},

		/*
		 * Hides the tooltip, after clearing existing timers.
		 */
		_hideTooltip        : function () {
			this._clearTimers();
			this.hide();
		},

		/*
		 * Set the rendered content of the tooltip for the current
		 * trigger, based on (in order of precedence):
		 *
		 * a). The string/node content attribute value
		 * b). From the content lookup map if it is set, or
		 * c). From the title attribute if set.
		 */
		_setTriggerContent  : function ( node ) {
			var content = this.get( "content" );
			if ( content && !(content instanceof Node || Lang.isString( content )) ) {
				content = content[node.get( "id" )] || node.getAttribute( "title" );
			}
			this.setTriggerContent( content );
		},

		/*
		 * Set the currently bound trigger node information, clearing
		 * out the title attribute if set and setting up mousemove/out
		 * listeners.
		 */
		_setCurrentTrigger  : function ( node, x, y ) {

			var widget = this,
				currTrigger = widget._currTrigger,
				triggerHandles = widget._eventHandles.trigger;

			widget._setTriggerContent( node );

			triggerHandles.mouseMove = Y.on( "mousemove", Y.bind( widget._onNodeMouseMove, widget ), node );
			triggerHandles.mouseOut = Y.on( "mouseleave", Y.bind( widget._onNodeMouseLeave, widget ), node );

			var title = node.getAttribute( "title" );
			node.setAttribute( "title", "" );

			currTrigger.mouseX = x;
			currTrigger.mouseY = y;
			currTrigger.node = node;
			currTrigger.title = title;
		},

		/*
		 * Clear out the current trigger state, restoring
		 * the title attribute on the trigger node,
		 * if it was originally set.
		 */
		_clearCurrentTrigger: function () {
			var node, title, widget = this,
				currTrigger = widget._currTrigger,
				triggerHandles = widget._eventHandles.trigger;

			if ( currTrigger.node ) {
				node = currTrigger.node;
				title = currTrigger.title || "";

				currTrigger.node = null;
				currTrigger.title = "";

				triggerHandles.mouseMove.detach();
				triggerHandles.mouseOut.detach();
				triggerHandles.mouseMove = null;
				triggerHandles.mouseOut = null;

				node.setAttribute( "title", title );
			}
		},

		/*
		 * Cancel any existing show/hide timers
		 */
		_clearTimers        : function () {
			var timers = this._timers;
			if ( timers.hide ) {
				timers.hide.cancel();
				timers.hide = null;
			}
			if ( timers.show ) {
				timers.show.cancel();
				timers.show = null;
			}
		},

		/*
		 * Detach any stored event handles
		 */
		_clearHandles       : function () {
			var eventHandles = this._eventHandles;

			if ( eventHandles.delegate ) {
				this._eventHandles.delegate.detach();
			}
			if ( eventHandles.trigger.mouseOut ) {
				eventHandles.trigger.mouseOut.detach();
			}
			if ( eventHandles.trigger.mouseMove ) {
				eventHandles.trigger.mouseMove.detach();
			}
		}
	}, {

		// STATIC METHODS/PROPERTIES

		OFFSCREEN_X: OX,
		OFFSCREEN_Y: OY,

		ATTRS: {

			offsetX: {
				value: 15
			},
			offsetY: {
				value: 15
			},

			calcX        : {
				value: null
			},
			calcY        : {
				value: null
			},
			/*
			 * The tooltip content. This can either be a fixed content value,
			 * or a map of id-to-values, designed to be used when a single
			 * tooltip is mapped to multiple trigger elements.
			 */
			content      : {
				value: null
			},

			/*
			 * The set of nodes to bind to the tooltip instance. Can be a string,
			 * or a node instance.
			 */
			triggerNodes : {
				value : null,
				setter: function ( val ) {
					if ( val && Lang.isString( val ) ) {
						val = Node.all( val );
					}
					return val;
				}
			},

			/*
			 * The delegate node to which event listeners should be attached.
			 * This node should be an ancestor of all trigger nodes bound
			 * to the instance. By default the document is used.
			 */
			delegate     : {
				value : null,
				setter: function ( val ) {
					return Y.one( val ) || Y.one( "document" );
				}
			},

			/*
			 * The time to wait, after the mouse enters the trigger node,
			 * to display the tooltip
			 */
			showDelay    : {
				value: 250
			},

			/*
			 * The time to wait, after the mouse leaves the trigger node,
			 * to hide the tooltip
			 */
			hideDelay    : {
				value: 10
			},

			/*
			 * The time to wait, after the tooltip is first displayed for
			 * a trigger node, to hide it, if the mouse has not left the
			 * trigger node
			 */
			autoHideDelay: {
				value: 2000
			},
			/*
			 * Determine if the tooltip will disappear automatically
			 * even if the mouse has not lef the trigger node
			 */
			autoHide     : {
				value: true
			},

			/*
			 * Override the default visibility set by the widget base class
			 */
			visible      : {
				value: false
			},

			/*
			 * Override the default XY value set by the widget base class,
			 * to position the tooltip offscreen
			 */
			xy           : {
				value: [OX, OY]
			}
		}
	} );
}, "1.0", {requires: [
	'node',
	'event',
	'event-mouseenter',
	'base-build',
	'widget',
	'widget-stack',
	'widget-position',
	'widget-position-align',
	'widget-position-constrain'
]
} );