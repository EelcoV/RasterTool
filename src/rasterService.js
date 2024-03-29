/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
 H, LS, Preferences, Project, RefreshNodeReportDialog, Transaction, _, bugreport, createUUID, isSameString, jsPlumb, nid2id, removetransientwindows, SizeDOMElements, workspacedrophandler, reasonableString
*/

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Service: object representing one service.
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	cid: UUID of the currently active (loaded) service; must be a service of Project with id==Project.cid
 *	_all: Map of all services, indexed on service ID
 *	_rectDragOrigin: ({top, left}) support variable when dragging a selection rectangle on the diagrams tab
 *	_scrollerDragging: (bool) support variable when dragging the minimap
 *	_nodesBeingDragged: (bool) support variable when dragging the selection rectangle on the diagrams tab
 *	get(i): returns the object with id 'i'.
 *	titleisused(p,str,e): checks whether there is a service in project p, other than service e, having title str.
 * Instance properties:
 *	id: (string) UUID
 *	project: (UUID) project to which this service belongs
 *	title: (string) short name of the service (max 50 chars).
 *	_loaded: boolean, indicates whether all DOM elements have been created;
 *		necessary to avoid painting on non-existing DIVs.
 *	_jsPlumb: instance of jsPlumb for this service and workspace.
 *	sfsortorder: (string) current sort order of components on the Single Failures tab ('alpha', 'type', 'thrt')
 * Methods:
 *	destroy(): destructor for this object.
 *	settitle(t): change the title to 't' (50 chars max). The actual title may receive
 *		a numerical suffix to make it unique.
 *	autosettitle: choose a unique standard name.
 *		Either settitle() or autosettitle() must be called.
 *	setproject(p): change the project to which this service belongs to the one with id p.
 *	unload(): remove all DOM elements for this service and its nodes.
 *	load(): create and set all DOM elements for this service and its nodes.
 *  removetab(prefix): remove non-content DOM elements for diagrams or single failures
 *	insertab(prefix,idx): insert the non-content DOM elements for diagrams or single failures (the prefix) at position idx.
 *  _addtabdiagrams(idx): insert the content DOM elements for this service's diagram, at position idx
 *  _addtabsinglefs(idx): insert the content DOM elements for this service's single failures, at position idx
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
class Service {
	constructor(pid, id = createUUID()) {
		if (Service._all.has(id)) {
			bugreport("Service with id "+id+" already exists","Service.constructor");
		}
		this.id = id;
		this.project = pid;
		this.title = "";
		this._loaded=false;
		this._jsPlumb = jsPlumb.getInstance({
			PaintStyle: {
				strokeWidth: 3,
				stroke: '#666'
			},
			EndpointStyle: {
				strokeWidth: 10,
				fill: '#aaa'
			},
			EndpointHoverStyle: {
				fill: '#666',
				stroke: '#000'
			},
			DragOptions: { cursor: 'move' },
			Endpoint: [ 'Dot', { radius: 6 } ]
		});
		this.sfsortorder = 'alph';
		
		this.store();
		Service._all.set(this.id,this);
	}
	
	static get(id) { return Service._all.get(id); }
	
	static titleisused(projectid,str,except) {
		for (const idserv of Service._all) {
			// idserv = [id,Service object]
			if (idserv[0]==except) continue;
			if (idserv[1].project!=projectid)  continue;
			if (isSameString(idserv[1].title,str))  return true;
		}
		return false;
	}
	
	static autotitle(pid,str = _("New service")) {
		let targettitle = reasonableString(str);
		if (Service.titleisused(pid,targettitle,null)) {
			var n=0;
			do {
				targettitle = str + " (" + (++n) + ")";
			} while (Service.titleisused(pid,targettitle,null));
		}
		return targettitle;
	}

	destroy() {
		if (Project.cid==this.project) {
			this.unload();
		}
		var it = new NodeIterator({service: this.id});
		it.forEach(rn => rn.destroy());
		localStorage.removeItem(LS+'S:'+this.id);
		Service._all.delete(this.id);
	}
	
	settitle(newtitle) {
		newtitle = reasonableString(newtitle);
		if (newtitle=='')  return;
		var targettitle = newtitle;
		if (Service.titleisused(this.project,targettitle,this.id)) {
			var n=0;
			do {
				targettitle = newtitle + " (" + (++n) + ")";
			} while (Service.titleisused(this.project,targettitle,this.id));
		}
		this.title = targettitle;
		$('.servicename'+this.id).text(this.title);
		$('.tabtitle'+this.id).attr('title',this.title);
		$('#tab_diagramstabtitle'+this.id).text(this.title);
		$('#tab_singlefstabtitle'+this.id).text(this.title);
		this.store();
	}

	autosettitle() {
		this.settitle( Service.autotitle(this.project) );
	}

	setproject(p) {
		this.project = p;
		this.store();
	}

	unload() {
		if (!this._loaded) return;
		// Save the selectrect, if it is attached to this diagram. And if it isn't, it will be reattached automatically.
		$('#selectrect').hide().detach().appendTo('body');
		$('#scroller_overview'+this.id).hide();
		if (this.id==Service.cid) {
			$('#nodereport').hide();
		}
		// Be sure to only remove nodes from this service.
		var it = new NodeIterator({service: this.id});
		it.forEach(rn => rn.unpaint());
		this._jsPlumb.reset();
		this.removetab('tab_diagrams');
		this.removetab('tab_singlefs');
		this._loaded=false;
	}

	load() {
		let p = Project.get(this.project);
		let idx = p.services.indexOf(this.id);
		let jsp = this._jsPlumb;
		this.inserttab('tab_diagrams',idx);
		this.inserttab('tab_singlefs',idx);
		this._addtabdiagrams();
		this._addtabsinglefs();
		
		var origpos;
		$('#selectrect').draggable({
			start: function(event,ui) {
				origpos = ui.position;
				Service._nodesBeingDragged = Node.nodesinselection();
				// Remember the original positions in the (scratchpad) undo_data data-property of #selectrect
				let undo_data = [];
				for (const nid of Service._nodesBeingDragged) {
					let n = Node.get(nid);
					undo_data.push({id: n.id, x: n.position.x, y: n.position.y});
				}
				$('#selectrect').data('undo_data',undo_data);
			},
			drag: function(event,ui) {
				// Drag all nodes in the selection
				var dx = (ui.position.left-origpos.left);
				var dy = (ui.position.top-origpos.top);
				origpos = ui.position;
				for (const nid of Service._nodesBeingDragged) {
					var n = Node.get(nid);
					n.setposition(n.position.x+dx,n.position.y+dy,false);
				}
			},
			stop: function(/*event,ui*/) {
				Service._nodesBeingDragged = Node.nodesinselection();
				let do_data = [];
				for (const nid of Service._nodesBeingDragged) {
					let n = Node.get(nid);
					do_data.push({id: n.id, x: n.position.x, y: n.position.y});
				}
				let undo_data = $('#selectrect').data('undo_data');
				// Restore previous geometry, necessary for testing only
				for (const d of undo_data) {
					let n = Node.get(d.id);
					n.position.x = d.x;
					n.position.y = d.y;
					n.store();
				}
				new Transaction('nodeGeometry', undo_data, do_data, _("Move nodes"));
				$('#selectrect').removeData('undo_data');
			},
			cursor: 'move'
		});
		
		jsp.setContainer('diagrams_workspace'+this.id);
		jsp.bind('beforeDrop', dropfunction );
		// Delay all jsPlumb paint operations
		jsp.setSuspendDrawing(true);
		/* First paint all the nodes, before drawing the connectors */
		var it = new NodeIterator({service: this.id});
		it.forEach(rn => rn.paint());
		
		/* All nodes exist, now draw connectors. When node X is connected to
		 * node Y, then also node Y is connected to node X. However, we must
		 * only draw their connector once. We therefore only draw a connector
		 * when X.id < Y.id
		 */
		it.forEach(rn => {
			rn.connect.forEach(on =>  {
				var dst = Node.get(on);
				if (dst.service!=this.id) {
					bugreport('inconsistency in connections between nodes','Service.paintall');
				}
				if (rn.id<dst.id) {
					rn.attach_center(dst);
				}
			});
		});
		jsp.setSuspendDrawing(false, true);
		it.forEach(rn => rn.setmarker());
		RefreshNodeReportDialog();
		this._loaded=true;
		SizeDOMElements();	// to size the scroller and it's parts
	}
	
	removetab(tabprefix) {
		// Remove the tab contents
		$('#'+tabprefix+this.id).remove();
		// Remove the bottom tab (the one that controls div#tabprefix+sid)
		$('#'+tabprefix).find('li[aria-controls='+tabprefix+this.id+']').remove();
		$('#'+tabprefix).tabs('refresh');
		if (tabprefix=='tab_diagrams') {
			$('#scroller_overview'+this.id).remove();
		}
	}

	inserttab(tabprefix,idx) {
		let p = Project.get(this.project);
		var snippet = '<li id="_PF_servicetab_I_">\
			<a href="#_PF__I_">\
			  <span id="_PF_tabtitle_I_" title="_T_" class="tabtitle tabtitle_I_">_T_</span>\
			</a>\
				<span id="_PF_tabclose_I_" class="ui-icon ui-icon-close tabcloseicon" role="presentation">Remove Tab</span>\
			</li>\
			';
		snippet = snippet.replace(/_T_/g, H(this.title));
		snippet = snippet.replace(/_I_/g, this.id);
		snippet = snippet.replace(/_PF_/g, tabprefix);
		if (idx==null || idx>$('#'+tabprefix+' .ui-tabs-nav li').length) {
			$('#'+tabprefix+' .ui-tabs-nav').append(snippet);
		} else if (idx==0) {
			$('#'+tabprefix+' .ui-tabs-nav').prepend(snippet);
		} else {
			$('#'+tabprefix+' .ui-tabs-nav li').eq(idx-1).after(snippet);
		}
		
		$('a[href^="#'+tabprefix+this.id+'"]').on('dblclick',  diagramTabEditStart );
		$('a[href^="#'+tabprefix+this.id+'"]').on('click',  function(/*evt,ui*/) {
			var s = Service.get(nid2id(this.hash));
			Preferences.setservice(s.title);
		} );
		
		function bottomdabshandler(domelem) {
			return function() {
				// Set the new order of services
				let arr = $(domelem).sortable('toArray');
				arr.forEach((v,i) => arr[i] = nid2id(v));
				// Check if the new order is really different
				if (arr.every((v,i) => v==p.services[i]))  return;
				// Really different, so enter a transaction
				new Transaction('serviceReorder',
					{project: p.id, list: p.services},
					{project: p.id, list: arr},
					_("Reorder services")
				);
			};
		}
		$('#bottomtabs'+tabprefix).sortable({
			containment: 'parent',
			scroll: false,
			stop: bottomdabshandler('#bottomtabs'+tabprefix)
		});
	}
	
	_addtabdiagrams() {
		var serviceid = this.id; // For use in event handler functions
		
		/* Add content to the new tab */
		var snippet = '\n\
			<div id="tab_diagrams_I_" class="ui-tabs-panel ui-widget-content ui-corner-tl workspace">\n\
			<div id="scroller_overview_I_" class="scroller_overview">\n\
				<div id="scroller_region_I_" class="scroller_region"></div>\n\
			</div></div>\n\
		';
		snippet = snippet.replace(/_I_/g, this.id);
		$('#tab_diagrams').append(snippet);
		snippet = '\n\
			<h1 class="printonly servicename_I_">_SN_</h1>\n\
			<h2 class="printonly projectname">_PN_</h2>\n\
			<div id="diagrams_workspace_I_" class="fancyworkspace"></div>\n\
		';
		snippet = snippet.replace(/_I_/g, this.id);
		snippet = snippet.replace(/_SN_/g, H(this.title));
		snippet = snippet.replace(/_PN_/g, H(Project.get(this.project).title));
		snippet = snippet.replace(/_PJ_/g, this.project);
		$('#tab_diagrams'+this.id).append(snippet);
		$('#tab_diagrams').tabs('refresh');

		/* Note: Firefox warns about scroll-linked positioning effects in combination with asynchronous
		 * scrolling. It may be better to implement this event handler asynchronously, although the
		 * improvement may be small because the visual impact of the scroller_region movement is tiny.
		 */
		// Update the scroll_region when the workspace is scrolled.
		$('#tab_diagrams'+this.id).on('scroll', function(/*event*/){
			if (Service._scrollerDragging)  return;
			var wst = $('#tab_diagrams'+serviceid).scrollTop();
			var wsl = $('#tab_diagrams'+serviceid).scrollLeft();
			var fh = $('.fancyworkspace').height();
			var fw = $('.fancyworkspace').width();
			var oh = $('#scroller_overview'+serviceid).height();
			var ow = $('#scroller_overview'+serviceid).width();
			$('#scroller_region'+serviceid).css('top',(wst*oh)/fh+'px').css('left',(wsl*ow)/fw+'px');
		});

		$('#scroller_overview'+this.id).draggable({
//			stop: function(/*event,ui*/){
//				var l = $('#scroller_overview'+serviceid).position().left;
//				var w = $('#tab_diagrams'+serviceid).width();
//				$('#scroller_overview'+serviceid).css('right', (w-l) + 'px').css('left','');
//			},
			containment: 'parent',
			cursor: 'move'
		});
		$('#diagrams_workspace'+this.id).on('mousedown', function(evt) {
			if (evt.button!=0)  return; // only do left mousebutton
			if (evt.eventPhase==Event.BUBBLING_PHASE)  return; // Only direct events
			Service._rectDragOrigin.left = evt.pageX;
			Service._rectDragOrigin.top = evt.pageY;
			$('#selectrectC').hide();
			$('#selectrect').show().offset({left: evt.pageX, top: evt.pageY}).width(0).height(0);
			$('#diagrams_workspace'+serviceid).on('mousemove', function(evt) {
				// only do plain left mousebutton drags
				if (evt.button!=0 || evt.shiftKey || evt.ctrlKey || evt.altKey || evt.metaKey)  return;

				// If any text was selected (accidentally, most likely), then deselect it.
				window.getSelection().removeAllRanges();
				var w = evt.pageX-Service._rectDragOrigin.left;
				var h = evt.pageY-Service._rectDragOrigin.top;
				if (w<0 || h<0) {
					var o = $('#selectrect').offset();
					if (w<0) {
						o.left = Service._rectDragOrigin.left + w;
						w = -w;
					}
					if (h<0) {
						o.top = Service._rectDragOrigin.top + h;
						h = -h;
					}
					$('#selectrect').offset({left: o.left, top: o.top}).width(w).height(h);
				} else {
					$('#selectrect').width(w).height(h);
				}
			});
			removetransientwindows();
		});
		$('#diagrams_workspace'+this.id).on('mouseup',  function(evt) {
			// only do plain left mousebutton drags
			if (evt.button!=0)  return;
			if (evt.target.id=="")  return; // Only direct events, or drag-stops
			// Direct click on the workspace, steal the focus from wherever it was.
			$( document.activeElement ).trigger('blur');
			// If any text was selected (accidentally, most likely), then deselect it.
			window.getSelection().removeAllRanges();
			//console.debug("Stole the focus");
			$('#diagrams_workspace'+serviceid).off('mousemove');
			if ($('#selectrect').width()>20 && $('#selectrect').height()>20) {
				$('#selectrectC').show();
			} else {
				$('#selectrect').hide();
			}
		});

		$('#scroller_region'+this.id).draggable({
			cursor: 'move',
			containment: 'parent',
			drag: function(/*event, ui*/) {
				var rO = $('#scroller_region'+serviceid).position();
				var fh = $('.fancyworkspace').height();
				var fw = $('.fancyworkspace').width();
				var oh = $('#scroller_overview'+serviceid).height();
				var ow = $('#scroller_overview'+serviceid).width();
				/* 
				 */
				var dtop = (rO.top * fh)/oh;
				var dleft = (rO.left * fw)/ow;
				if (dtop<0) dtop=0;
				if (dleft<0) dleft=0;
				$('#tab_diagrams'+serviceid).scrollTop(dtop);
				$('#tab_diagrams'+serviceid).scrollLeft(dleft);
			},
			start: function() {
				Service._scrollerDragging = true;
			},
			stop: function() {
				Service._scrollerDragging = false;
			}
		});

		$('.fancyworkspace').droppable({
			accept: '.templatebg',
			drop: workspacedrophandler
		});
	}

	_addtabsinglefs() {
		/* Add content to the new tab */
		var snippet = '\n\
			<div id="tab_singlefs_I_" class="ui-tabs-panel ui-widget-content ui-corner-tl workspace"></div>\n\
		';
		snippet = snippet.replace(/_I_/g, this.id);
		$('#tab_singlefs').append(snippet);
		snippet = '\n\
			<h1 class="printonly servicename_I_">_LSF_: _SN_</h1>\n\
			<h2 class="printonly projectname">_PN_</h2>\n\
			<div id="singlefs_workspace_I_" class="workspace plainworkspace sfworkspace"></div>\n\
		';
		snippet = snippet.replace(/_LSF_/g, _("Single failures"));
		snippet = snippet.replace(/_I_/g, this.id);
		snippet = snippet.replace(/_SN_/g, H(this.title));
		snippet = snippet.replace(/_PN_/g, H(Project.get(this.project).title));
		snippet = snippet.replace(/_PJ_/g, this.project);
		$('#tab_singlefs'+this.id).append(snippet);
		$('#tab_singlefs').tabs('refresh');
		$('#tab_singlefs ul li').removeClass('ui-corner-top');
		$('#tab_singlefs').on('click', '.topbuttons', function(event) {
			if (event.target!=this) return; // Only direct clicks, not clicks on buttons that bubble
			let id = $(this).parent().parent().attr('id');
			$('#'+id).accordion('option','active',false);
		});
	}

	_stringify() {
		var data = {};
		data.l=this.title;
		data.p=this.project;
		return JSON.stringify(data);
	}

	exportstring() {
		var key = LS+'S:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	}

	store() {
		var key = LS+'S:'+this.id;
		localStorage[key] = this._stringify();
	}
}

Service.cid = 0;
Service._all = new Map();
Service._rectDragOrigin = {left:0, top:0};
Service._scrollerDragging = false;
Service._nodesBeingDragged = [];


/* This function is called before a connection is made when dragging
 * from the dragpoint of a node onto another node.
 */
function dropfunction(data) {
	var src = Node.get(nid2id(data.sourceId));
	var dst = Node.get(nid2id(data.targetId));

	if (!src || !dst) {
        bugreport("Incorrect nodes","dropfunction");
        return;
	}

    if (data.scope=='center') {
        bugreport("Connection in center scope","dropfunction");
        return;
    }
    src.try_attach_center(dst);
	Service.get(src.service)._jsPlumb.deleteEndpoint(data.dropEndpoint);
}

function diagramTabEditStart(/*event*/) {
	var s = Service.get(nid2id(this.hash));
	var dialog = $('<div></div>');
	var snippet ='\
		<form id="form_servicerename">\
			<!-- Prevent implicit submission of the form -->\
			<button type="submit" disabled style="display: none" aria-hidden="true"></button>\
		<input id="field_servicerename" class="field_rename" name="fld" type="text" value="_SN_">\
		</form>\
	';
	snippet = snippet.replace(/_SN_/g, H(s.title));
	dialog.append(snippet);
	var dbuttons = [];
	dbuttons.push({
		text: _("Cancel"),
		click: function() {
				$(this).dialog('close');
			}
	});
	dbuttons.push({
		text: _("Change name"),
		click: function() {
				let name = $('#field_servicerename');
				new Transaction('serviceRename',
					[{id: s.id, title: s.title}],
					[{id: s.id, title: name.val()}],
					_("Rename service")
				);
				$(this).dialog('close');
			}
	});
	dialog.dialog({
		title: _("Rename service '%%'", s.title),
		classes: {"ui-dialog-titlebar": "ui-corner-top"},
		modal: true,
		position: {my: 'center', at: 'center'},
		width: 350,
		height: 130,
		buttons: dbuttons,
		open: function() {
			$('#field_servicerename').focus().select();
		},
		close: function(/*event, ui*/) {
			dialog.remove();
		}
	});
}

