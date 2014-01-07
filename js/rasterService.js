/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * $Id: rasterService.js,v 1.1.1.1.4.4.2.2.2.9 2013/07/18 19:52:23 vriezekolke Exp $
 *
 * Service: object representing one service.
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	cid: integer ID of the currently active service
 *	_all[]: array of all services, indexed on service ID
 *	get(i): returns the object with id 'i'.
 *	titleisused(p,str,e): checks whether there is a service in project p, other than
 *		service e, having title str.
 * Instance properties:
 *	id: (integer) unique ID of the service
 *	project: (object) project to which this service belongs
 *	title: (string) short name of the service (max 50 chars).
 *	_painted: boolean, indicates whether all Nodes have been painted already;
 *		necessary to avoid painting them twice.
 *	_loaded: boolean, indicates whether all DOM elements have been created;
 *		necessary to avoid painting on non-existing DIVs.
 * Methods:
 *	destroy(): destructor for this object.
 *	settitle(t): change the title to 't' (50 chars max). The actual title may receive
 *		a numerical suffix to make it unique. This.project must be set first!
 *	autosettitle: choose a unique standard name. The project must be set first!
 *		Either settitle() or autosettitle() must be called.
 *	setproject(p): change the project to which this service belongs to the one with id p.
 *	unload(): remove all DOM elements for this service, except nodes.
 *	load(): create and set all DOM elements for this service, except nodes.
 *	repaintconnectors: remove and repaint all connections between nodes in this service
 *	unpaintall(): remove all Nodes for this service.
 *	paintall(): create and set all Nodes for this service.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var Service = function(id) {
	if (id!=null && Service._all[id]!=null)
		bugreport("Service with id "+id+" already exists","Service.constructor");
	this.id = (id==null ? nextUnusedIndex(Service._all) : id);
	this.project = Project.cid;
	this.title = "";
	this._painted=false;
	this._loaded=false;
	
	this.store();
	Service._all[this.id]=this;
};
Service.get = function(id) { return Service._all[id]; };
Service.cid = 0;
Service._all = [];
Service.titleisused = function(projectid,str,except) {
	var found=false;
	for (var i=0; !found && i<Service._all.length; i++) {
		if (i==except) continue;
		if (Service._all[i]!=null && Service._all[i].project==projectid)
			found=(Service._all[i].title==str);
	}
	return found;
};

Service.prototype = {
	destroy: function() {
		if (Project.cid==this.project)
			this.unload();
		var it = new NodeIterator({service: this.id});
		for (it.first(); it.notlast(); it.next())
			it.getnode().destroy(false);		
		localStorage.removeItem(LS+'S:'+this.id);
		Service._all[this.id]=null;
	},
	
	settitle: function(newtitle) {
		newtitle = trimwhitespace(String(newtitle)).substr(0,50);
		if (newtitle=='') return;
		var targettitle = newtitle;
		if (Service.titleisused(this.project,targettitle,this.id)) {
			var n=0;
			do 
				targettitle = newtitle + " (" + (++n) + ")";
			while (Service.titleisused(this.project,targettitle,this.id));
		}
		this.title = targettitle;
		$('.servicename'+this.id).html(H(this.title));
		$('.tabtitle'+this.id).attr('title',H(this.title));
		$('#diagramstabtitle'+this.id).text(this.title);
		$('#singlefstabtitle'+this.id).text(this.title);
		this.store();
	},

	autosettitle: function() {
		this.settitle("New service");
	},

	setproject: function(p) {
		this.project = p;
		this.store();
	},

	unload: function() {
		this.unpaintall();
		closeDiagramTab(this.id,this.title,'diagrams');
		closeDiagramTab(this.id,this.title,'singlefs');
		this._loaded=false;
	},

	load: function() {
		newDiagramTab(this.id,this.title,'diagrams');
		newDiagramTab(this.id,this.title,'singlefs');
		this._loaded=true;
//		this.paintall();
	},
	
	repaintconnectors: function() {
		if (!this._loaded || !this._painted) return;
		var it = new NodeIterator({service: this.id});	
		/* First, remove all connectors
		 * Then, recreate them. This is similar to bottom half of paintall.
		 */
		for (it.first(); it.notlast(); it.next()) {
			var rn = it.getnode();
			jsPlumb.detachAllConnections(rn.nid);
		}
		for (it.first(); it.notlast(); it.next()) {
			rn = it.getnode();
			for (var j=0; j<rn.connect.length; j++) {
				var dst = Node.get(rn.connect[j]);
				if (DEBUG && dst.service!=this.id) 
					bugreport('inconsistency in connections between nodes','Service.paintall');
				if (rn.id<dst.id)
					rn.attach_center(dst);
			}
		}
	},

	unpaintall: function() {
		$('#scroller_overview'+this.id).hide();
		if (!this._painted) return;
		if (this.id==Service.cid)
		$('#nodereport').hide();
//		jsPlumb.deleteEveryEndpoint();
//		$('.node').remove();
//		$('.tinynode').remove();
// Previous implementation		
		// Be sure to only remove nedes from this service.
		var it = new NodeIterator({service: this.id});
		for (it.first(); it.notlast(); it.next())
			it.getnode().unpaint();
		this._painted=false;
	},
	
	paintall: function() {
		if (!this._loaded) return;
		// For some reason, the mouseup event on #selectrect is only fired consistently when
		// the #selectrect div is inside the workspace. If the div is inside diagrams_body or
		// inside the main <body>, the mouseup is almost always 'lost'. We therefore have to
		// delete #selectrect, resurrect it, and re-bind the menu event handler.
		$('.scroller_overview').hide();
		$('#scroller_overview'+this.id).show();
		$('#selectrect').remove();
		$('#diagrams_workspace'+this.id).append("<div id='selectrect'></div>");
		$('#selectrect').bind('contextmenu', function(e) {
			e.preventDefault();
			$('#selectmenu').css("left", e.pageX+4).css("top", e.pageY+4);
			$('.popupsubmenu').hide();
			$('#selectmenu').css("display", "block");
			return false;
		});
		var origpos;
		$('#selectrect').draggable({
			start: function(event,ui) {
				origpos = ui.position;
				NodesBeingDragged = Node.nodesinselection();
			},
			drag: function(event,ui) {
				// Drag all nodes in the selection
//				var nodes = Node.nodesinselection();
				var dx = (ui.position.left-origpos.left);
				var dy = (ui.position.top-origpos.top);
				origpos = ui.position;
				for (var i=0; i<NodesBeingDragged.length; i++) {
					var n = Node.get(NodesBeingDragged[i]);
					n.setposition(n.position.x+dx,n.position.y+dy,false);
				}
			},
			stop: function(event,ui) {
				if (Preferences.grid) {
					for (var i=0; i<NodesBeingDragged.length; i++) {
						var n = Node.get(NodesBeingDragged[i]);
						n.setposition(n.position.x,n.position.y);
					}
				}
				transactionCompleted("Node move selection");
			},
			cursor: 'move'
		});
		
		if (this._painted) return;
		/* First paint all the nodes, before drawing the connectors */
		var it = new NodeIterator({service: this.id});
		for (it.first(); it.notlast(); it.next())
			it.getnode().paint(false);
		
		/* All nodes exist, now draw connectors. When node X is connected to
		 * node Y, then also node Y is connected to node X. However, we must
		 * only draw their connector once. We therefore only draw a connector
		 * when X.id < Y.id
		 */
		for (it.first(); it.notlast(); it.next()) {
			var rn = it.getnode();
			for (var j=0; j<rn.connect.length; j++) {
				var dst = Node.get(rn.connect[j]);
				if (DEBUG && dst.service!=this.id) 
					bugreport('inconsistency in connections between nodes','Service.paintall');
				if (rn.id<dst.id)
					rn.attach_center(dst);
			}
		}
		Service.cid = this.id;
		//$('a[href=#diagram'+this.id+']').next().css('z-index','0');
		this._painted=true;
	},

	_stringify: function() {
		var data = {};
		data.l=this.title;
		data.p=this.project;
		return JSON.stringify(data);
	},

	exportstring: function() {
		var key = LS+'S:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},

	store: function() {
		var key = LS+'S:'+this.id;
		localStorage[key] = this._stringify();
	}
};

var RectDragOrigin = {left:0, top:0};
var ScrollerDragging = false;
var NodesBeingDragged = [];

/* newDiagramTab: draw the HTML DOM elements for service with given id and title
 */
function newDiagramTab(id,title,tabprefix) {	
	/* Create a new tab */
	var snippet = '<span id="'+tabprefix+'tabtitle_I_" title="_T_" class="tabtitle tabtitle_I_">_T_</span>';
	snippet = snippet.replace(/_T_/g, H(title));
	snippet = snippet.replace(/_I_/g, id);
	$('#'+tabprefix+'_body').tabs('add', '#'+tabprefix+id, snippet);
	/* We have bottom tabs, so have to correct the tab corners */
	$('#'+tabprefix+'_body li').removeClass('ui-corner-top').addClass('ui-corner-bottom');
	$("a[href^=#"+tabprefix+id+"]").dblclick( diagramTabEditStart );

	/* Set class on the new workspace */
	$('#'+tabprefix+id).addClass("workspace");

	/* Add content to the new tab */
	if (tabprefix=="diagrams") {
		snippet = '\n\
			<div id="scroller_overview_I_" class="scroller_overview">\n\
				<div id="scroller_region_I_" class="scroller_region"></div>\n\
			</div>\n\
		';
		snippet = snippet.replace(/_I_/g, id);
		$('#diagrams_body').append(snippet);
		snippet = '\n\
			<h1 class="printonly underlay servicename_I_">_SN_</h1>\n\
			<h2 class="printonly underlay projectname">Project: _PN_</h2>\n\
			<div id="'+tabprefix+'_workspace_I_" class="fancyworkspace"></div>\n\
		';
	} else {
		snippet = '\n\
			<h1 class="printonly underlay servicename_I_">Single failures: _SN_</h1>\n\
			<h2 class="printonly underlay projectname">Project: _PN_</h2>\n\
			<div id="'+tabprefix+'_workspace_I_" class="workspace plainworkspace"></div>\n\
		';
	}
	snippet = snippet.replace(/_I_/g, id);
	snippet = snippet.replace(/_SN_/g, H(title));
	snippet = snippet.replace(/_PN_/g, H(Project.get(Service.get(id).project).title));
	snippet = snippet.replace(/_PJ_/g, Service.get(id).project);
	$('#'+tabprefix+id).append(snippet);

	// Update the scroll_region when the workspace is scrolled.
	$('#'+tabprefix+id).scroll( function(event){
		if (ScrollerDragging) return;
		var wst = $('#diagrams'+id).scrollTop(); 
		var wsl = $('#diagrams'+id).scrollLeft(); 
		var fh = $('.fancyworkspace').height();
		var fw = $('.fancyworkspace').width();
		var oh = $('#scroller_overview'+id).height();
		var ow = $('#scroller_overview'+id).width();
		$('#scroller_region'+id).css("top",(wst*oh)/fh+"px").css("left",(wsl*ow)/fw+"px");
	});

	if (tabprefix=="diagrams") {
		$('#scroller_overview'+id).draggable({
			stop: function(event,ui){
				var l = $('#scroller_overview'+id).position().left;
				var w = $('#diagrams'+id).width();
				$('#scroller_overview'+id).css("right", (w-l) + "px").css("left","");
			},
			containment: 'parent',
			cursor: "move"
		});
//		$('#'+tabprefix+'_workspace'+id).click( function(evt){
//			// This handler is called whenever the fancyworkspace is clicked, or when
//			// any of the DOM elements within the fancyworkspace is clicked. We only want
//			// to execute when there was a direct click on the background. Check the
//			// eventPhase for that.
//			if (evt.eventPhase==Event.BUBBLING_PHASE) return;
//			// Direct click on the workspace, steal the focus from wherever it was.
//			$( document.activeElement ).blur();
//			// If any text was selected (accidentally, most likely), then deselect it.
//			window.getSelection().removeAllRanges();
//			//console.debug("Stole the focus");
//		});
		$('#'+tabprefix+'_workspace'+id).mousedown( function(evt) {
			if (evt.button!=0) return; // only do left mousebutton
			if (evt.eventPhase==Event.BUBBLING_PHASE) return; // Only direct events
			RectDragOrigin = {left: evt.pageX, top: evt.pageY};
			$('#selectrect').show().offset({left: evt.pageX, top: evt.pageY}).width(0).height(0);
			$('#'+tabprefix+'_workspace'+id).on("mousemove", function(evt) {
				if (evt.button!=0 || evt.shiftKey || evt.ctrlKey || evt.altKey || evt.metaKey) 
					return; // only do plain left mousebutton drags
				// If any text was selected (accidentally, most likely), then deselect it.
				window.getSelection().removeAllRanges();
				var w = evt.pageX-RectDragOrigin.left;
				var h = evt.pageY-RectDragOrigin.top;
				if (w<0 || h<0) {
					var o = $('#selectrect').offset();
					if (w<0) {
						o.left = RectDragOrigin.left + w;
						w = -w;
					}
					if (h<0) {
						o.top = RectDragOrigin.top + h;
						h = -h;
					}
					$('#selectrect').offset({left: o.left, top: o.top}).width(w).height(h);
				} else {
					$('#selectrect').width(w).height(h);
				}
			});
			removetransientwindows();
		});
		$('#'+tabprefix+'_workspace'+id).mouseup( function(evt) {
			if (evt.button!=0) 
				return; // only do plain left mousebutton drags
			// Direct click on the workspace, steal the focus from wherever it was.
			$( document.activeElement ).blur();
//			if ($('#selectrect').width()==0)
			if (Node.nodesinselection().length==0)
				$('#selectrect').hide();
			// If any text was selected (accidentally, most likely), then deselect it.
			window.getSelection().removeAllRanges();
			//console.debug("Stole the focus");
			$('#'+tabprefix+'_workspace'+id).unbind("mousemove");
		});
//		$('#'+tabprefix+'_workspace'+id).draggable({
//			cursor: "move",
//			drag: function(event, ui) {
//				var fh = $('.fancyworkspace').height();
//				var fw = $('.fancyworkspace').width();
//				var oh = $('#scroller_overview'+id).height();
//				var ow = $('#scroller_overview'+id).width();
//				var wh = $('.workspace').height();
//				var ww = $('.workspace').width();
// 				var o = ui.position;
//				if (o.left>0) o.left=0;
//				if (o.top>0) o.top=0;
//				if (ww-o.left>fw) o.left=ww-fw;
//				if (wh-o.top>fh) o.top=wh-fh;
//				$(this).css('top', o.top+'px'); 
//				$(this).css('left', o.left+'px');
//				var or = {};
//				or.left = -o.left*ow/fw;
//				or.top = -o.top*oh/fh;
//				$('#scroller_region'+id).css('top', or.top+'px');
//				$('#scroller_region'+id).css('left', or.left+'px');
//			}
//		});
	}
	$("#scroller_region"+id).draggable({
		cursor: "move",
		containment: 'parent',
		drag: function(event, ui) {
			var rO = $('#scroller_region'+id).position();
			var fh = $('.fancyworkspace').height();
			var fw = $('.fancyworkspace').width();
			var oh = $('#scroller_overview'+id).height();
			var ow = $('#scroller_overview'+id).width();
			/* 
			 */
			var dtop = (rO.top * fh)/oh;
			var dleft = (rO.left * fw)/ow;
			if (dtop<0) dtop=0;
			if (dleft<0) dleft=0;
//			$('#diagrams_workspace'+Service.cid).css('top', '-'+dtop+'px'); 
//			$('#diagrams_workspace'+Service.cid).css('left', '-'+dleft+'px'); 
			$('#diagrams'+id).scrollTop(dtop); 
			$('#diagrams'+id).scrollLeft(dleft); 
		},
		start: function() {
			ScrollerDragging = true;
		},
		stop: function() {
			ScrollerDragging = false;
		}
	});

	$('.workspace').droppable({
		accept: '.templatebg,#nNote',
		drop: workspacedrophandler
	});
	SizeDOMElements();
}

/* closeDiagramTab(serviceid): close the diagramming tab for service with title servicetitle.
 * Problem is that there is no fixed relation between service (or service id) and
 * tab: 1) tabs can be reordered, 2) services can be removed.
 * The tab has the following HTML elements (ss = service id, tt = service title):
 * 
 * <li class="class list">
 *	 <a href="#diagram<ss>">
 *		<span id="tabtitle<ss>"><tt></span>
 *	 </a>
 * </li>
 */
function closeDiagramTab(sid,servicetitle,tabprefix) {
	var found=-1;
	$('#'+tabprefix+'_body ul li').each(function(i){
		var s = $(this).text();
		if (s==servicetitle) {
			found = i;
			return false;
		}
	});
	if (found!=-1)
		$('#'+tabprefix+'_body').tabs("remove",found);
	if (tabprefix=="diagrams")
		$('#scroller_overview'+sid).remove();
}

/* This is ugly, but the callback is called twice and I don't know why?! */
Service.editinprogress = false;

function diagramTabEditStart(event) {
	if (Service.editinprogress)
		return;
	Service.editinprogress=true;
	var s = Service.get(nid2id(this.hash));
	var dialog = $('<div></div>');
	var snippet ='\
		<form id="form_servicerename">\
		<input id="field_servicerename" name="fld" type="text" size="55" value="_SN_">\
		</form>\
	';
	snippet = snippet.replace(/_SN_/g, H(s.title));
	dialog.append(snippet);
	dialog.dialog({
		title: "Rename service '" + H(s.title) + "'",
		modal: true,
		position: [80,'center'],
		width: 405,
		height: 130,
		buttons: {
			"Change name": function() {
				var name = $('#field_servicerename');
				s.settitle(name.val());
				$(this).dialog("close");
				transactionCompleted("Service rename");
			},
			Cancel: function() {
				$(this).dialog("close");
			}
		},
		open: function() {
			$('#field_servicerename').focus().select();
			$('#form_servicerename').submit(function() {
				var name = $('#field_servicerename');
				s.settitle(name.val());
				dialog.dialog("close");
			});
		},
		close: function(event, ui) {
			dialog.remove();
			Service.editinprogress=false;
		}
	});
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * ServiceIterator: iterate over all services of a project
 *
 * usage:
 * 		var it = new ServiceIterator(projectID);
 * 		for (it.first(); it.notlast(); it.next()) {
 *			var s = it.getservice();
 *	 		:
 *		}
 */
var ServiceIterator = function(pid) {
	this.pid = pid;
	this.index = 0;
//	this.item = Project.get(pid).services;
	this.item = [];
	for (var i=0; i<Service._all.length; i++) {
		if (Service._all[i]==null) continue;
		var s =  Service._all[i];
		if (s.project == pid)
			this.item.push(i);
	}
};
ServiceIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	notlast: function() {return (this.index < this.item.length);},
	getservice: function() {return Service.get( this.item[this.index] );},
	getserviceid: function() {return this.item[this.index];}
};

