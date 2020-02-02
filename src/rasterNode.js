/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
 Component, H, LS, NodeCluster, NodeClusterIterator, Preferences, Project, Service, Threat, ThreatAssessment, Transaction, _, arrayJoinAsString, bugreport, createUUID, isSameString, nid2id, plural, populateLabelMenu, transactionCompleted, trimwhitespace, displayComponentThreatAssessmentsDialog
 */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Node: an element in a telecom service diagram
 *
 * Class properties & methods (those prefixed with underscore should not be accessed from outside)
 *	_all: array of all Node elements, indexed by id
 *	get(i): returns the object with id 'i'.
 *	projecthastitle(p,str): project 'p' has a node with title 'str'.
 *	servicehastitle(s,str): service 's' has a node with title 'str'.
 *	autotitle(type,str): create a unique title based on 'str' for a node of type 'typ' IN THE CURRENT PROJECT AND SERVICE.
 * Instance properties:
 *	type: one of 'tWLS','tWRD','tEQT','tACT','tUNK', 'tNOT'
 *  index: index of the icon in the current iconset
 *	title: name of the node
 *	suffix: letter a,b,c... or user-set string to distiguish nodes with the same title. The suffix is retained
 *		even when the node is the only remember member of its class.
 *	id: UUID
 *	component: component object for this node; null for tNOT and tACT
 *	nid (getter): node ID in DOM format
 *	jnid (getter): node ID in jQuery format (#id of the DOM element)
 *  project (getter): project to which the node belongs
 *	service: ID of the service to which this node belongs
 *	position: current position on workspace, and size {x,y,width,height}
 *	dragpoint: jsPlumb endpoint from which to drag new connectors
 *	centerpoint: jsPlumb endpoint to which connectors are attached
 *	color: node label
 *	connect[]: array over Node id's of booleans, indicating whether this
 *		Node is connected to each other Node.
 *	_normw: normal width (default width)
 *	_normh: normal height (default height)
 * Methods:
 *	destroy(): destructor.
 *	setposition(x,y,snap): set the position of the HTML document object to (x,y).
 *		If snap==false then do not restrict to 20x20 pixel grid positions.
 *	iconinit: choose an icon and set the width/height of the node.
 *	setcomponent(cm): set the id of the component object to cm.
 *	changetitle(str): post a transaction to change the header text to 'str' if allowed.
 *	settitle(str,suff): sets the header text to 'str' and suffix 'suff', and update DOM.
 *	changesuffix(str): post a transaction to change the suffix to 'str' if allowed
 *	setsuffix(str): set the suffix to 'str' and update DOM.
 *	htmltitle(): returns this title, properly html formatted when the node has a suffix (except for css classes)
 *	setmarker(): sets or hides the rule violation marker.
 *	hidemarker(): hides the rule violation marker.
 *	showmarker(): shows the rule violation marker.
 *	setlabel(): sets the color and updats the DOM.
 *	try_attach_center(dst): called when this node gets connected to Node dst.
 *	attach_center(dst): create and draw the connector.
 *	detach_center(dst): called when the connection from this node to Node dst
 *		is removed.
 *	addtonodeclusters(): for each of the threats to this component, insert the 
 *		node into the corresponding node cluster.
 *	removefromnodeclusters(): remove this node from all node clusters.
 *  editinprogress(): true iff the title is being edited in place.
 *	paint(effect): create and show the HTML document object for this node, but 
 *		not its connections. Fade-in if effect==true.
 *	unpaint: hide and remove the HTML document object for this node, including
 *		all its connections.
 *	_edgecount(): counts the total number of edges to other nodes, by type.
 *	_edgeUnderflow(ec): determines to which node-types connections can still
 *		be allowed; ec is the result from a preview edgecount.
 *	_getreport(): returns a array of strings describing which connection
 *		rules are violated, in natural language.
 *	_connectionsOK(): returns whether all connection rules are obeyed.
 *	_showpopupmenu(x,y): populate and display the popup menu.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var Node = function(type, serv, id) {
	if (!id) {
		console.warn("*** No id specified for new Node");
	}if (id!=null && Node._all[id]!=null) {
		bugreport("Node with id "+id+" already exists","Node.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.type = type;
	this.index = null;
	this.service = serv;
	this.position = {x: 0, y: 0, width: 0, height: 0};
	this.connect = [];
	this._normw = 0;
	this._normh = 0;
	this.component = null;
	this.title = "";
	this.suffix = 'a';
	// Sticky notes are traditionally yellow
	this.color = (this.type=='tNOT' ? "yellow" : "none");

	this.store();
	Node._all[this.id] = this;
};
Node._all = new Object();
Node.get = function(id) { return Node._all[id]; };
Node.projecthastitle = function(pid,str) {
	for (var i in Node._all) {
		if (isSameString(Node._all[i].title,str)) {
			var s = Service.get(Node._all[i].service);
			if (s.project==pid)  return i;
		}
	}
	return -1;
};
Node.servicehastitle = function(sid,str) {
	for (var i in Node._all) {
		if (isSameString(Node._all[i].title,str) && Node._all[i].service==sid)  return i;
	}
	return -1;
};
Node.nodesinselection = function() {
	var a = [];
	var o = $('#selectrect').offset();
	var sl = o.left;
	var st = o.top;
	var sw = $('#selectrect').width(); 	
	var sh = $('#selectrect').height(); 
	var ni = new NodeIterator({service: Service.cid});
	for (ni.first(); ni.notlast(); ni.next()) {
		var rn = ni.getnode();
		if (rn.iscontainedin(sl,st,sw,sh)) {
			a.push(rn.id);
		}
	}
	return a;
};
Node.destroyselection = function () {
	Node.nodesinselection().forEach(n => Node.get(n).destroy());
//	var a = Node.nodesinselection();
//	for (var i=0; i<a.length; i++) {
//		var rn = Node.get(a[i]);
//		rn.destroy();
//	}
};
Node.autotitle = function(typ,newtitle) {
	if (!newtitle)  newtitle = Rules.nodetypes[typ];
	if (typ=='tNOT')  return newtitle;

	// Non-greedy match for anything, optionally followed by space and digits between parentheses
	let targettitle, n;
	let res = newtitle.match(/^(.+?)( \((\d+)\))?$/);
	if (res[3]) {
		n = parseInt(res[3],10)+1;
		newtitle = res[1];
	} else {
		n = 0;
	}
	// If the title resembles that of a type, make sure it's the correct one (e.g. the Change type menuitem)
	for (const t in Rules.nodetypes) {
		if (Rules.nodetypes[t] != newtitle)  continue;
		newtitle = Rules.nodetypes[typ];
		n = 0;
		break;
	}

	targettitle = newtitle;
	if (n>0)  targettitle = targettitle + ' (' + n + ')';
	// Actors must be unique within the service, other nodes must be unique within the project
	if (typ=='tACT') {
		while (Node.servicehastitle(Service.cid,targettitle)!=-1) {
			n++;
			targettitle = newtitle + ' (' + n + ')';
		}
	} else {
		while (Node.projecthastitle(Project.cid,targettitle)!=-1) {
			n++;
			targettitle = newtitle + ' (' + n + ')';
		}
	}
	return targettitle;
};

Node.prototype = {
	get nid() {
		return 'node'+this.id;
	},

	get jnid() {
		return '#node'+this.id;
	},

	get project() {
		return Service.get(this.service).project;
	},

	destroy: function(effect) {
		var jsP = Service.get(this.service)._jsPlumb;
		if (this.centerpoint) jsP.deleteEndpoint(this.centerpoint);
		if (this.dragpoint) jsP.deleteEndpoint(this.dragpoint);
		if (this.component!=null) {
			var cm = Component.get(this.component);
			cm.removenode(this.id);
			cm.repaintmembertitles();
			this.component = null;
		}

		if (this.id==$('#nodereport').data('DialogNode')) {
			$('#nodereport').dialog('close');
		}
		if (this.component==Component.ThreatsComponent) {
			$('#componentthreats').dialog('close');
		}
		var neighbours = this.connect.slice(0); // duplicate the array
		for (var i=0; i<neighbours.length; i++) {
			var nb = Node.get(neighbours[i]);
			this.detach_center( nb );
			if (nb.id==$('#nodereport').data('DialogNode')) RefreshNodeReportDialog();
		}
		
		this.removefromnodeclusters();
		
		localStorage.removeItem(LS+'N:'+this.id);
		this.hidemarker();  // Make it disappear before the animation starts
		$('#tinynode'+this.id).remove();
		delete Node._all[this.id];
		if (effect==undefined || effect==true) {
			$(this.jnid).effect('explode', 500, function() {
				var id = nid2id(this.id);
				jsP.remove('node'+id);
			});
		} else {
			// Prevent an error when jsPlumb is asked to remove a node that is not part of the DOM (anymore)
			var node = $(this.jnid);
			if (node.length>0)  jsP.remove(this.nid);
		}
	},

	setposition: function(px,py,snaptogrid) {
		var jsP = Service.get(this.service)._jsPlumb;
		var fh = $('.fancyworkspace').height();
		var fw = $('.fancyworkspace').width();
		var oh = $('#scroller_overview'+this.service).height();
		var ow = $('#scroller_overview'+this.service).width();
		var dO = {};
		if (snaptogrid==null) {
			snaptogrid = true;
		}
		
		if (px<0) px=0;
		if (py<10) py=10;
		if (px+this.position.width>fw) px=fw-this.position.width;
		if (py+this.position.height>fh) py=fh-this.position.height;
		
		if (snaptogrid) {
			var cx = px+this.position.width/2;
			var cy = py+this.position.height/2;
			cx = 20*Math.round(cx/20);
			cy = 20*Math.round(cy/20);
			px = cx - this.position.width/2;
			py = cy - this.position.height/2;
		}
		
		this.position.x = px;
		this.position.y = py;
		this.store();
		$(this.jnid).css('left',px+'px').css('top',py+'px');
		$(this.jnid).css('width',this.position.width+'px').css('height',this.position.height+'px');
		jsP.revalidate(this.nid);

		dO.left = (px * ow)/fw;
		dO.top = (py * oh)/fh;
		$('#tinynode'+this.id).css('left', dO.left);
		$('#tinynode'+this.id).css('top', dO.top);
	},
	
	setcomponent: function(c) {
		if (this.type=='tNOT') {
			bugreport("Attempt to attach component to a note","Node.setcomponent");
		}
		if (this.type=='tACT') {
			bugreport("Attempt to attach component to an actor","Node.setcomponent");
		}
		this.component = c;
		this.store();
	},
	
	changetitle: function(str) {
		str = trimwhitespace(str);
		// Blank title is not allowed. Retain current title.
		if (str==this.title || str=='')  return;

		switch (this.type) {
		case 'tNOT':
			// Notes can be identical (can have the same 'title').
			new Transaction('nodeTitle',
				[{id: this.id, title: this.title}],
				[{id: this.id, title: str}]
			);
			break;

		case 'tACT':
			// Actors don't have (nor need) components, but have unique names within the service
			new Transaction('nodeTitle',
				[{id: this.id, title: this.title}],
				[{id: this.id, title: Node.autotitle('tACT',str)}]
			);
			break;

		default:
			var prevcomponent = Component.get(this.component);
			if (!prevcomponent) {
				bugreport("no such component","Node.changetitle");
			}
			// See if there is an existing component with this title & type
			var n = Component.hasTitleTypeProject(str,this.type,this.project);
			if (n==-1 && prevcomponent.nodes.length==1) {
				// Simple case, no classes involved
				new Transaction('nodeTitle',
					[{id: this.id, title: this.title}],
					[{id: this.id, title: str}]
				);
			} else if (n==prevcomponent.id) {
				// New title is strictly different, but case-insensitive identical
				// Only allow case-change when there is no class involved. Changing the name of the
				// class requires the node menu: Class | Rename class
				if (prevcomponent.nodes.length>1)  return;
				new Transaction('nodeTitle',
								[{id: this.id, title: this.title}],
								[{id: this.id, title: str}]
								);
			} else if (n==-1) {
				// This node drops out of a class
				let p = Project.get(prevcomponent.project);

				// This node drops out of the class, but the class continues to exist
				new Transaction('nodeTitle',
					[{id: this.id, title: this.title, suffix: this.suffix, component: prevcomponent.id}],
					[{id: this.id, title: str, component: createUUID(), thrass: p.defaultthreatdata(prevcomponent.type)}]
				);
			} else {
				// The new name of this node matches an existing Component: join a class
				// add this node to that component
				var cm = Component.get( n );
				// Not allowed if the component is 'single' and this node's service already contains a member of the component.
				if (cm.single) {
					for (const n of cm.nodes) {
						let rn = Node.get(n);
						if (rn.service==this.service) {
							// do not change the title
							$(this.jnid).effect('pulsate', { times:2 }, 800);
							$(rn.jnid).effect('pulsate', { times:2 }, 800);
							return;
						}
					}
				}

				new Transaction('nodeTitle',
					[{
						id: this.id, title: this.title, suffix: this.suffix,
						component: prevcomponent.id, thrass: prevcomponent.threatdata(), accordionopened: prevcomponent.accordionopened
					}],
					[{id: this.id, title: str, suffix: cm.newsuffix(), component: cm.id}]
				);
			}
		}
	},

	settitle: function(str,suff) {
		this.title=str;
		if (suff!=null)  this.suffix=suff;
if (suff=='') bugreport('empty suffix','Node.settitle');

		let cm = Component.get(this.component);
		if (cm) {
			$('#nodetitle'+this.id).removeClass('marktitleM marktitleS');
			if (cm.nodes.length>1) {
				$('#nodetitle'+this.id).addClass( (cm.single?'marktitleS':'marktitleM') );
			}
		}
		$('#titlemain'+this.id).html(H(this.title));
		if (cm && cm.nodes.length>1 && !cm.single) {
			$('#titlesuffix'+this.id).html('&thinsp;<sup>'+H(this.suffix)+'</sup>');
		} else {
			$('#titlesuffix'+this.id).html('');
		}
		if ($('#nodereport').data('DialogNode')==this.id)  RefreshNodeReportDialog();
		this.store();
	},

	changesuffix: function(str) {
		str = trimwhitespace(str);
		if (str==this.suffix || str=="")  return;

		new Transaction('nodeSuffix',
			[{id: this.id, suffix: this.suffix}],
			[{id: this.id, suffix: str}]
		);
	},

	setsuffix: function(str) {
		this.suffix = str;
		this.settitle(this.title,this.suffix);
	},

	htmltitle: function() {
		// Node may have a suffix even when the only member of its "class"
		let cm = Component.get(this.component);
		if (cm && cm.nodes.length>1) {
			return H(this.title) + '<sup>&thinsp;'+H(this.suffix)+'</sup>';
		} else {
			return H(this.title);
		}
	},
	
	_edgecount: function () {
		var jsP = Service.get(this.service)._jsPlumb;
		var C = {'tWLS':0, 'tWRD':0, 'tEQT':0, 'tACT':0, 'tUNK':0, 'TOTAL':0};
		var conn = jsP.getConnections({scope:'center'});
		for (var i=0; i<conn.length; i++) {
			/* Use conn[i].sourceId and conn[i].targetId */
			if (this.nid==conn[i].sourceId) {
				C['TOTAL']++;
				C[Node.get(nid2id(conn[i].targetId)).type]++;
			}
			if (this.nid==conn[i].targetId) {
				C['TOTAL']++;
				C[Node.get(nid2id(conn[i].sourceId)).type]++;
			}
		}
		return C;
	},
	
	_edgeUnderflow: function(ec) {
		var opt = [];
		for (var t in Rules.nodetypes) {
			if (t!='TOTAL' && ec[t]<Rules.edgeMax[this.type][t]) opt.push(Rules.nodetypes[t]);
		}
		return opt;
	},
	
	_getreport: function () {
		var report = [];
		var C = this._edgecount();
		var minhave = Rules.totaledgeMin[this.type];
		var maxhave = Rules.totaledgeMax[this.type];
		if (C['TOTAL']<Rules.totaledgeMin[this.type]) {
			var toolittle = minhave-C['TOTAL'];
			var options = arrayJoinAsString(this._edgeUnderflow(C), _("or"));
			var unlimited = (maxhave==99);
			var conns = plural(_("connection"),_("connections"),minhave);
			report.push( 
				(unlimited ? _("Must have at least %% %% ", minhave,conns) : _("Must have %% %% ", minhave,conns))
					+ (C['TOTAL']>0 ? _(" (you only have %%). ",C['TOTAL']) : _("(you have none)."))
					+ " "
					+ _("Add %% %% to a %%.", toolittle, plural(_("connection"),_("connections"),toolittle), options)
			);
		}
		if (C['TOTAL']>Rules.totaledgeMax[this.type]) {
			var toomany = C['TOTAL'] - Rules.totaledgeMax[this.type];
			report.push( 
				_("Can have at most %% %%", maxhave, plural(_("connection"),_("connections"),maxhave))
				+ _(" (you have %%).", C['TOTAL'])
			);
			if (toomany==1) {
				report.push(_("Remove one connection to a neighbouring node."));
			} else {
				report.push(_("Remove %% connections to neighbouring nodes.",toomany));
			}
		}
		var mustadd = [];
		var mustremove = [];
		for (var j in C) {
			if (C[j]<Rules.edgeMin[this.type][j]) {
				mustadd.push( Rules.nodetypes[j] );
			}
			if (C[j]>Rules.edgeMax[this.type][j]) {
				mustremove.push( Rules.nodetypes[j] );
			}
		}
		if (mustadd.length>0) {
			var nds = (mustadd.length==1 ? mustadd[0] : arrayJoinAsString(mustadd,_("and")));
			report.push(
				(mustadd.length==1 ? _("A connection must be added to a node of type %%.",nds) : _("Connections must be added to nodes of type %%.", nds))
			);
		}
		if (mustremove.length>0) {
			nds = (mustremove.length==1 ? mustremove[0] : arrayJoinAsString(mustremove,_("and")));
			report.push(
				(mustremove.length==1 ? _("A connection must be removed from a node of type %%.",nds) : _("Connections must be removed from nodes of type %%.",nds))
			);
		}
		
		return report;
	},
	
	_connectionsOK: function() {
		var C = this._edgecount();
		if (C['TOTAL']<Rules.totaledgeMin[this.type])  return false;
		if (C['TOTAL']>Rules.totaledgeMax[this.type] && Rules.totaledgeMax[this.type]>-1)  return false;
		for (var j in C) {
			if (C[j]<Rules.edgeMin[this.type][j])  return false;
			if (C[j]>Rules.edgeMax[this.type][j] && Rules.edgeMax[this.type][j]>-1)  return false;
		}
		return true;
	},
	
	setmarker: function() {
		if (this.type=='tNOT')  return;
		if (!this._connectionsOK()) {
			$('#nodeMagnitude'+this.id).hide();
			this.showmarker();
		} else {
			// Actors have a marker but no component
			if (this.component!=null) {
				var m = Component.get(this.component).magnitude;
				var mi = ThreatAssessment.valueindex[m];
				$('#nodeMagnitude'+this.id).text(m);
				$('#nodeMagnitude'+this.id).removeClass('M0 M1 M2 M3 M4 M5 M6 M7').addClass('M'+mi);
				$('#nodeMagnitude'+this.id).attr('title',ThreatAssessment.descr[mi]);
				$('#nodeMagnitude'+this.id).show();
			}
			this.hidemarker();
		}
	},

	hidemarker: function() {
		$('#nodeW'+this.id).removeClass('markhi').addClass('marklo');
	},
	
	showmarker: function() {
		$('#nodeW'+this.id).removeClass('marklo').addClass('markhi');
	},
	
	setlabel: function(str) {
		$('#nodeheader'+this.id).removeClass(this.color);
		$('#nodecolorbackground'+this.id).removeClass('B'+this.color);
		$('#nodeimg'+this.id).removeClass('I'+this.color);
		this.color = str;
		this.store();
		$('#nodeheader'+this.id).addClass(this.color);
		$('#nodecolorbackground'+this.id).addClass('B'+this.color);
		$('#nodeimg'+this.id).addClass('I'+this.color);
		if (!Preferences.label) {
			$('#nodeheader'+this.id).addClass('Chide');
		}
	},
	
	try_attach_center: function(dst) {
		// Never attach a node to itself. This only applies to Unknown Links, as no other type
		// can be connected to a node of that same type.
		if (this.id==dst.id)  return;
		var Csrc = this._edgecount();
		var Cdst = dst._edgecount();
		// The node counts do not included the intended connection from this to dst.
		Csrc['TOTAL']++;
		Csrc[dst.type]++;
		Cdst['TOTAL']++;
		Cdst[dst.type]++;
		/* Node 'this' has Csrc['TOTAL'] edges, Csrc[t] per type t; this includes one edge
		 * to the node of type dst.type.
		 * Disallow the edge only if either the maximum total number of edges,
		 * or the maximum number of edges to nodes of type dst.type has been
		 * exceeded. Vice versa for dst and Cdst.
		 */
		if (this.connect.indexOf(dst.id)>-1) {
			/* Already connected. Detach the newly attached connection
		  	 * without visual feedback.
		  	 */
			null;
		} else if (
			Csrc['TOTAL']>Rules.totaledgeMax[this.type]
			|| Cdst['TOTAL']>Rules.totaledgeMax[dst.type]
			|| Csrc[dst.type]>Rules.edgeMax[this.type][dst.type]
			|| Cdst[this.type]>Rules.edgeMax[dst.type][this.type]
		) {
			/* do not attach the nodes, and flash the elements for visual feedback. */
			$(this.jnid).effect('pulsate', { times:2 }, 800);
			$(dst.jnid).effect('pulsate', { times:2 }, 800);
		} else {
			/* Move the begin and endpoints to the center points */
			new Transaction('nodeConnect',
				[{id: this.id, otherid: dst.id, connect: false}],
				[{id: this.id, otherid: dst.id, connect: true}]
			);
			RefreshNodeReportDialog();
		}
	},
	
	attach_center: function(dst) {
		var jsP = Service.get(this.service)._jsPlumb;
		var edge = jsP.connect({
			sourceEndpoint: this.centerpoint,
			targetEndpoint: dst.centerpoint,
			connector: 'Straight',
			scope: 'center',
			overlays: [[ 'Label', {
					label: '⊗',
					cssClass: 'connbutton',
					events: {
						click: function(labelOverlay /*, originalEvent*/) {
							var node1 = labelOverlay.component.sourceId;
							var node2 = labelOverlay.component.targetId;
							var src = Node.get(nid2id(node1));
							var dst = Node.get(nid2id(node2));
							new Transaction('nodeConnect',
								[{id: src.id, otherid: dst.id, connect: true}],
								[{id: src.id, otherid: dst.id, connect: false}]
							);
						}
					}
				}	
			]]
		});
		// attach_center is also used to repaint connectors (e.g. on page load), so it is
		// not necessarily a bug if the nodes are already connected.
		if (this.connect.indexOf(dst.id)==-1) {
			this.connect.push(dst.id);
			this.store();
		}
		if (dst.connect.indexOf(this.id)==-1) {
			dst.connect.push(this.id);
			dst.store();
		}
	},
	
	detach_center: function(dst) {
		var i;
		i = this.connect.indexOf(dst.id);
		if (i==-1) {
			bugreport('incorrect connection info (A)','Node.detach_center');
		}
		this.connect.splice( i,1 );
		i = dst.connect.indexOf(this.id);
		if (i==-1) {
			bugreport('incorrect connection info (B)','Node.detach_center');
		}
		dst.connect.splice( i,1 );		
		this.store();
		dst.store();
		this.setmarker();
		dst.setmarker();
		RefreshNodeReportDialog();
	},

	addtonodeclusters: function() {
		if (this.component==null) {
			bugreport("Node's component has not been set","Node.addtonodeclusters");
		}
		var cm = Component.get(this.component);
		for (var i=0; i<cm.thrass.length; i++) {
			var ta = ThreatAssessment.get(cm.thrass[i]);
			NodeCluster.addnode_threat(Project.cid,this.id,ta.title,ta.type);
		}
	},
	
	removefromnodeclusters: function() {
		var it =  new NodeClusterIterator({project: Project.cid, isroot: true});
		for (it.first(); it.notlast(); it.next()) {
			var nc = it.getNodeCluster();
			if (nc.containsnode(this.id)) {
				nc.removechildnode(this.id);
				nc.normalize();
//				if (nc.childclusters.length==0 && nc.childnodes.length==0 && nc.parentcluster==null) {
//					nc.destroy();
//				}
			}
		}		
	},

	iscontainedin: function(left,top,w,h) {
		var no = $(this.jnid).offset();
		var nw = $(this.jnid).width();
		var nh = $(this.jnid).height();
		return (no.left>=left && no.left+nw<=left+w
			&& no.top>=top && no.top+nh<=top+h);
	},

	editinprogress: function() {
		return $('#titlemain'+this.id).hasClass('editInPlace-active');
	},

	iconinit: function() {
		var p = Project.get(this.project);
		// Locate the first possible index
		for (this.index=0; this.index<p.icondata.icons.length && p.icondata.icons[this.index].type!=this.type; this.index++) {
			// empty
		}
		this.position.width = p.icondata.icons[this.index].width;
		this.position.height = p.icondata.icons[this.index].height;
		this._normw = this.position.width;
		this._normh = this.position.height;
		this.store();
	},

	paint: function(effect) {
		var p = Project.get(this.project);
		if (!this.index)  this.iconinit();

		var icn = p.icondata.icons[this.index];
		var jsP = Service.get(this.service)._jsPlumb;
		if (this.position.x<0 || this.position.y<0
			|| this.position.x>3000 || this.position.y>3000) {
			bugreport("extreme values of node '"+H(this.title)+"' corrected", "Node.paint");
			this.position.x = 100;
			this.position.y = 100;
			this.store();
		}
		var str = '\n\
			<div id="node_ID_" class="node node_TY_" tabindex="2">\n\
				<div id="nodecolorbackground_ID_" class="nodecolorbackground B_CO_"></div>\n\
				<img id="nodeimg_ID_" src="../img/iconset/_IS_/_IM_" class="contentimg I_CO_">\n\
				<div id="nodeheader_ID_" class="nodeheader _HB_ _CO_">\n\
				  <div id="nodetitle_ID_" class="_TB_"><span id="titlemain_ID_"></span><span id="titlesuffix_ID_"></span></div>\n\
				</div>\n\
				<img id="nodeC_ID_" class="nodeC" src="../img/dropdown.png">\n\
				<img id="nodeW_ID_" class="nodeW" src="../img/warn.png">\n\
				<div id="nodeMagnitude_ID_" class="nodeMagnitude"></div>\n\
			</div>\n\
			';
		str = str.replace(/_ID_/g, this.id);
		str = str.replace(/_TY_/g, this.type);
		str = str.replace(/_IS_/g, p.iconset);
		str = str.replace(/_IM_/g, icn.image);
		str = str.replace(/_CO_/g, (Preferences.label ? this.color : 'none'));
		if (icn.title == 'below') {
			str = str.replace(/_HB_/g, 'headerbelow');
			str = str.replace(/_TB_/g, 'titlebelow');
		} else if (icn.title == 'topleft') {
			str = str.replace(/_HB_/g, 'headertopleft');
			str = str.replace(/_TB_/g, 'titletopleft');
		} else {
			str = str.replace(/_HB_/g, 'headerinside');
			str = str.replace(/_TB_/g, 'titleinside');
		}
		$('#diagrams_workspace'+this.service).append(str);
		this.setmarker();
		$('#nodeheader'+this.id).css('--margin', icn.margin+'%');
		// See comments in raster.css at nodecolorbackground
		$('#nodecolorbackground'+this.id).css('-webkit-mask-image', 'url(../img/iconset/'+p.iconset+'/'+icn.mask+')');
		$('#nodecolorbackground'+this.id).css('-webkit-mask-image', '-moz-element(#'+icn.maskid+')');

		str = '<div id="tinynode_ID_" class="tinynode"></div>\n';
		str = str.replace(/_ID_/g, this.id);
		$('#scroller_overview'+this.service).append(str);

		// Under a different iconset the aspect ratio may be off. Enlarge it, if necessary
		if (icn.maintainAspect) {
			var newh = this.position.width * icn.height/icn.width;
			if (newh > this.position.height) {
				this.position.height = newh;
			} else {
				this.position.width = this.position.height * icn.width/icn.height;
			}
			this.store();
		}
		$(this.jnid).width(this.position.width);
		$(this.jnid).height(this.position.height);

		this.settitle(this.title);

		if (effect==undefined || effect==true) {
			$(this.jnid).fadeIn(500);
		} else {
			$(this.jnid).css('display', 'block');
		}
		this.setposition(this.position.x, this.position.y, false);

		/* This is *not* jQuery's draggable, but Katavorio's!
		 * See https://github.com/jsplumb/katavorio/wiki
		 */
		jsP.draggable($(this.jnid), {
			containment: 'parent',
			distance: 10,	// prevent drags when clicking the menu activator
			opacity: 0.8,
			filter: '.ui-resizable-handle',
			start: function(event,ui) {
				// Remember the original positions in the (scratchpad) undo_data property of the node
				let rn = Node.get( nid2id(event.el.id) );
				if (event.e.shiftKey) {
					rn.undo_data = [];
					var ni = new NodeIterator({service: rn.service});
					for (ni.first(); ni.notlast(); ni.next()) {
						var n = ni.getnode();
						rn.undo_data.push({id: n.id, x: n.position.x, y: n.position.y});
					}
				} else {
					rn.undo_data = [{id: rn.id, x: rn.position.x, y: rn.position.y}];
				}
			},
			stop: function(event) {
				let rn = Node.get( nid2id(event.el.id) );
				let do_data;
				if (event.e.shiftKey) {
					do_data = [];
					var ni = new NodeIterator({service: rn.service});
					for (ni.first(); ni.notlast(); ni.next()) {
						var n = ni.getnode();
						do_data.push({id: n.id, x: n.position.x, y: n.position.y});
					}
				} else {
					do_data = [{id: rn.id, x: rn.position.x, y: rn.position.y}];
				}
				// A filter on insignificant position changes, to prevent 'pollution' of the undo stack
				// Since all nodes in the (un)do_data move by the same delta, we only need to inspect the first.
				if (Math.abs(do_data[0].x-rn.undo_data[0].x) > 10
				 || Math.abs(do_data[0].y-rn.undo_data[0].y) > 10
				) {
					// Restore previous geometry, necessary for testing only
					for (const d of rn.undo_data) {
						let n = Node.get(d.id);
						n.position.x = d.x;
						n.position.y = d.y;
						n.store();
					}
					new Transaction('nodeGeometry', rn.undo_data, do_data);
				}
				delete rn.undo_data;
				// Disallow dragging for 100msec
				setTimeout( function(){rn.dragging=false;}, 100);
			},
			drag: function(event) {
				var rn = Node.get( nid2id(event.el.id) );
				var dx = event.pos[0] - rn.position.x;
				var dy = event.pos[1] - rn.position.y;
				rn.dragging = true;
				if (event.e.shiftKey) {
					// Drag the whole service diagram
					var ni = new NodeIterator({service: rn.service});
					for (ni.first(); ni.notlast(); ni.next()) {
						var n = ni.getnode();
						n.setposition(n.position.x+dx,n.position.y+dy);
					}
				} else {
					rn.setposition(rn.position.x+dx,rn.position.y+dy);
				}
			}
		});
		if (this.type!='tNOT') {
			this.dragpoint = jsP.addEndpoint(this.nid, {
				// For clouds, the dragpoint is slightly off-center.
				anchor: (this.type=='tUNK' ? [0.66,0,0,-1] : 'TopCenter'),
				isSource: true,
				isTarget: false,
				connector: ['Bezier', { curviness: 100 } ], // When dragging
				source: this.oid,
				dragProxy: [ 'Dot', {radius: 12, cssClass: 'draggedEndpoint'}],
				scope: 'dragpoint',
				dropOptions: { scope: 'node' }
			});
			// Drop connections onto the target node, not on the dragpoint of the target node (as in older versions).
			jsP.makeTarget(this.nid, {
				allowLoopback: false,
				deleteEndpointsOnEmpty: true,
				isSource: false,
				isTarget: true,
				source: this.oid,
				scope: 'node',
				dropOptions: { scope: 'dragpoint' }
			});
			$(this.dragpoint.canvas).css({visibility: 'hidden'});
			this.centerpoint = jsP.addEndpoint(this.nid, {
				anchor: 'Center',
				paintStyle: {fill:'transparent'},
				isSource: false,
				isTarget: false,
				enabled: false,
				maxConnections: -1, // unlimited
				scope: 'center'
			});
		}

		$(this.jnid).on('mouseenter', function(evt) {
			// If a mouse button is down, then Firefox will set .buttons to nonzero.
			// Google Chrome does not set .buttons, but uses .which; when a mouse button is down
			// .which will be non-zero.
			// On Firefox, .which appears to be 1 always.
			// Return is a mouse button is down.
			if (evt.buttons!=null) {
				if (evt.buttons!=0)  return;
			} else {
				if (evt.which!=0)  return;
			}
			var id = nid2id(this.id);
			var rn = Node.get(id);
			if (!rn.editinprogress()) this.focus();
			$('#nodeC'+id).css({visibility: 'visible'});
			if (rn.dragpoint) $(rn.dragpoint.canvas).css({visibility: 'visible'});
			if (Preferences.emsize=='em_none') {
				$('#nodeMagnitude'+id).addClass('doshow');
			}
		}).on('mouseleave',function() {
			var id = nid2id(this.id);
			var rn = Node.get(id);
			this.blur();
			if (!rn.editinprogress()) this.blur();
			$('#nodeC'+id).css({visibility: 'hidden'});
			if (rn.dragpoint) $(rn.dragpoint.canvas).css({visibility: 'hidden'});
			$('#nodeMagnitude'+id).removeClass('doshow');
		}).on('contextmenu', function(e) {
			e.preventDefault();
			var rn = Node.get(nid2id(this.id));
			rn._showpopupmenu(e);
			return false;
		}).on('keydown', function(evt){
			var rn = Node.get(nid2id(this.id));
			if (rn.editinprogress())  return;
			var i;
			// Previous label
			if (evt.key=='<') {
				i = Project.colors.indexOf(rn.color);
				i = (i-1+Project.colors.length) % Project.colors.length; // add length to prevent negative result
				$('#nodemenu').data('menunode',rn.id);
				$('#mi_cc'+Project.colors[i]).trigger('mouseup');
//				rn.setlabel(Project.colors[i]);
				evt.preventDefault();
				return;
			}
			// Next label
			if (evt.key=='>') {
				i = Project.colors.indexOf(rn.color);
				i = (i+1) % Project.colors.length;
				$('#nodemenu').data('menunode',rn.id);
				$('#mi_cc'+Project.colors[i]).trigger('mouseup');
//				rn.setlabel(Project.colors[i]);
				evt.preventDefault();
				return;
			}
			// Rename
			if (evt.key=='F2') {
				$('#titlemain'+rn.id).trigger('click');
				evt.preventDefault();
				return;
			}
			// Open vulnerabilities dialog
			if (evt.key=='Enter') {
				$('#nodemenu').data('menunode', rn.id);
				if (rn.type=='tNOT') {
					$('#titlemain'+rn.id).trigger('click');
				} else if (rn.type=='tACT') {
					/* do nothing */
				} else {
					displayComponentThreatAssessmentsDialog(rn.component,rn.jnid);
				}
				evt.preventDefault();
				return;
			}
			// Delete
			if (evt.key=='Delete' || evt.key=='Backspace') {
				$('#nodemenu').data('menunode', rn.id);
				$('#mi_de').trigger('mouseup');
				evt.preventDefault();
				return;
			}
		});

		$('#nodeC'+this.id).on('mousedown',  function(evt){
			var rn = Node.get(nid2id(this.id));
//			var offset = $(this).offset();
			rn._showpopupmenu(evt);
			return false;
		});
		$('#nodeC'+this.id).on('click',  function(/*event*/){ return false; });
		
		$('#nodeW'+this.id).on('click', function(e) {
			// this.id is like "nodeWxxx", where xxx is the node id number
			var id = nid2id(this.id);
			var rn = Node.get(id);
			var report = rn._getreport();
			var s;
			
			if (report.length==0) {
				s = _("Node is OK; there are no warnings.");
			} else {
				s = report.join('<p>');
			}
			if ($('#nodereport').dialog('isOpen')) {
				$('#nodereport').dialog('close');
			}
			$('#nodereport').html( s );
			$('#nodereport').dialog({
				title: _("Warning report on %%", rn.title+' '+rn.suffix),
				position: {my: 'left top', at: 'center', of: e, collision: 'fit'},
				open: function() {
					var o = $('#nodereport').dialog('widget').offset();
					$('#nodereport').dialog('widget')
					.css({display: "", opacity: 0})
					.animate({
						opacity: 1,
						left: o.left+(e.clientX==o.left? 20 : 0),
						top: o.top+(e.clientY==o.top ? 20 : 0)
					}, 250);
				}
			});
			$('#nodereport').dialog('open');
			$('#nodereport').data('DialogNode', id);
			return false;
		});
	
		$('#titlemain'+this.id).editInPlace({
			bg_over: 'rgb(255,204,102)',
			show_buttons: false,
			field_type: (this.type=='tNOT' ? 'textarea' : 'text'),
			callback: function(domid, enteredText) {
				var rn = Node.get( nid2id(domid) );
				rn.changetitle(enteredText);
				return H(rn.title);
			},
			/* Make sure that the editor is above all node decorations. */
			delegate: {
				shouldOpenEditInPlace: function(aDOMNode /*, aSettingsDict, triggeringEvent*/) {
					var id = nid2id(aDOMNode[0].id);
					var rn = Node.get(id);
					return (rn.dragging != true);
				},
				didOpenEditInPlace: function(aDOMNode /*, aSettingsDict*/) {
					var id = nid2id(aDOMNode[0].id);
					$('#node'+id).css('z-index','1001');
					$('#nodeheader'+id).css('z-index','1001');
					$('#nodetitle'+id+' span:last-child').css('display','none');
				},
				didCloseEditInPlace: function (aDOMNode /*, aSettingsDict*/) {
					var id = nid2id(aDOMNode[0].id);
					$('#node'+id).css('z-index',"");
					$('#nodeheader'+id).css('z-index','');
					$('#nodetitle'+id+' span:last-child').css('display',"");
				}
			}
		});
		
		/* Unfortunately, must set both min/max width and min/max height, even
		 * though aspectRatio=true. Obtain the current values, and allow double
		 * for maximum
		 */
		if (this._normw==0) this._normw = $(this.jnid).width();
		if (this._normh==0) this._normh = $(this.jnid).height();
		$(this.jnid).resizable({
			handles: 'se',
			autoHide: true,
			aspectRatio: (this.type=='tNOT' ? false : true),
			minWidth: this._normw,
			maxWidth: (this.type=='tNOT' ? 3 : 2) * this._normw,
			minHeight: this._normh,
			maxHeight: (this.type=='tNOT' ? 3 : 2) * this._normh,
			start: function(/*event,ui*/) {
				let rn = Node.get( nid2id(this.id) );
				rn.undo_data = {};
				for (let i in rn.position)  rn.undo_data[i] = rn.position[i];
			},
			resize: function(event,ui) {
				let rn = Node.get( nid2id(this.id) );
				rn.position.x -= (ui.size.width-rn.position.width)/2;
				rn.position.y -= (ui.size.height-rn.position.height)/2;
				rn.position.width=ui.size.width;
				rn.position.height=ui.size.height;
				rn.setposition(rn.position.x,rn.position.y);
			},
			stop: function (/*event,ui*/) {
				let rn = Node.get( nid2id(this.id) );
				let newposition = {};
				// Save new geometry
				for (let i in rn.position)  newposition[i] = rn.position[i];
				// Restore starting geometry
				for (let i in rn.undo_data)  rn.position[i] = rn.undo_data[i];
				rn.store();
				new Transaction('nodeGeometry',
					[{id: rn.id, x: rn.undo_data.x, y: rn.undo_data.y, width: rn.undo_data.width, height: rn.undo_data.height}],
					[{id: rn.id, x: newposition.x, y: newposition.y, width: newposition.width, height: newposition.height}]
				);
				delete rn.undo_data;
			}
		});
	},
	
	unpaint: function() {
		var jsP = Service.get(this.service)._jsPlumb;
		if (this.centerpoint) jsP.deleteEndpoint(this.centerpoint);
		if (this.dragpoint) jsP.deleteEndpoint(this.dragpoint);
		this.centerpoint=null;
		this.dragpoint=null;

		if (this.id==$('#nodereport').data('DialogNode')) {
			$('#nodereport').dialog('close');
		}
		$(this.jnid).remove();
		$('#tinynode'+this.id).remove();
	},

	_showpopupmenu: function(evt) {
		var p = Project.get(Project.cid);
		var cm = Component.get(this.component);
		$('#nodemenu .ui-menu-item').removeClass('ui-state-disabled');
		if (this.type=='tNOT') {
			$('#mi_th').addClass('ui-state-disabled');
			$('#mi_ct').addClass('ui-state-disabled');
			$('#mi_cl').addClass('ui-state-disabled');
		}
		if (this.type=='tACT') {
			$('#mi_th').addClass('ui-state-disabled');
			$('#mi_cl').addClass('ui-state-disabled');
		}
		if (cm==null || cm.nodes.length<2) {
			$('#mi_cl').addClass('ui-state-disabled');
		}
		if (cm!=null && cm.single) {
			$('#mi_sx').addClass('ui-state-disabled');
		}
		$('#mi_sm span.lc:first').html(cm!=null && cm.single ? _("Make class") : _("Make single"));
		if (cm!=null && cm.single) {
			$('#mi_du').addClass('ui-state-disabled');
		}
		// Do not allow a type change into its own type
		$('#mi_ct'+this.type).addClass('ui-state-disabled');
		populateLabelMenu();
		var s=p.strToLabel(this.color);
		if (s=='') {
			s = _("Label");
		} else {
			s = '"' + s + '"';
		}
		$('#mi_cc span.lc:first').html(s);
		$('#nodemenu').menu('collapseAll');
		$('#nodemenu').show();
		$('#nodemenu').position({
			my: "left top",
			at: "center",
			of: evt,
			collision: "flipfit"
		});
		$('#nodemenu').data('menunode', this.id);

	},
	
	_stringify: function() {
		// When comparing projects (e.g. for debugging) it is useful if the order of
		// items in the project file is the same.
		// Therefore sort nodes and thrass
		this.connect.sort();
		var data = {};
		data.t=this.type;
		data.l=this.title;
		data.f=this.suffix;
		data.x=Math.round(this.position.x);
		data.y=Math.round(this.position.y);
		data.w=Math.round(this.position.width);
		data.h=Math.round(this.position.height);
		data.v=Math.round(this._normw);
		data.g=Math.round(this._normh);
		data.s=this.service;
		data.c=this.connect;
		data.m=this.component;
		data.o=this.color;
		return JSON.stringify(data);
	},

	exportstring: function() {
		var key = LS+'N:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},

	store: function() {
		var key = LS+'N:'+this.id;
		localStorage[key] = this._stringify();
	},
	
	internalCheck: function() {
		var errors = "";
		let offender = "Node "+this.id;
		let key = LS+'N:'+this.id;
		let lsval = localStorage[key];

		if (!lsval) {
			errors += offender+" is not in local storage.\n";
		}
		if (lsval && lsval!=this._stringify()) {
			errors += offender+" local storage is not up to date.\n";
			console.log('local storage: ' + lsval);
			console.log('current state: ' + this._stringify());
		}
		if (Rules.nodetypes[this.type]==undefined) {
			errors += offender+" has weird type-value "+this.type+".\n";
		}
		if ((this.type=='tACT' || this.type=='tNOT') && this.component!=null) {
			errors += offender+" has a component, but should have none.\n";
		}
		if (this.component!=null && Component.get(this.component)==null) {
			errors += offender+" has invalid component.\n";
		}
		if (this.position.x<0 || this.position.x>9999 || this.position.y<0 || this.position.y>9999) {
			errors += offender+" has weird position.\n";
		}
		if (this.position.width<0 || this.position.width>999 || this.position.height<0 || this.position.height>999) {
			errors += offender+" has weird size.\n";
		}
		if (this.connect.indexOf(this.id)!=-1) {
			errors += offender+" is connected to itself.\n";
		}
		for (var i=0; i<this.connect.length; i++) {
			var rn = Node.get(this.connect[i]);
			if (!rn) {
				errors += offender+" is connected to node "+this.connect[i]+" which does not exist.\n";
				continue;
			}
			if (rn.connect.indexOf(this.id)==-1) {
				errors += offender+" is connected to node "+rn.id+", but not vice versa.\n";
			}
			if (this.service!=rn.service && this.id>rn.id) { // id-check is to avoid duplicate error messages
				errors += offender+" is connected to node "+rn.id+", which is in another service diagram.\n";
			}
		}
		// If this node is member of a singlular component, and it is not the first node of that component,
		// then this node should not appear in any node cluster
		var cm = Component.get(this.component);
		if (cm && !isSameString(cm.title,this.title)) {
			errors += offender+" has title ("+this.title+") that differs from its component ("+cm.title+").\n";
		}
		if (cm && cm.single && cm.nodes[0]!=this.id) {
			var it = new NodeClusterIterator({isroot: true});
			for (it.first(); it.notlast(); it.next()) {
				var nc = it.getNodeCluster();
				if (nc.containsnode(this.id)) {
					errors += offender+" is member of a singular class, yet appears in cluster '"+nc.title+"'.\n";
				}
			}
		} 
		return errors;
	}
};

function RefreshNodeReportDialog() {
	if (! $('#nodereport').dialog('isOpen'))  return;
	// Refresh the contents
	var rn = Node.get($('#nodereport').data('DialogNode'));
	var report = rn._getreport();
	var s;
				
	if (report.length==0) {
		s = _("Connections are OK; no warnings.");
	} else {
		s = report.join('<p>');
	}
	$('#nodereport').html( s );
	$('#nodereport').dialog({
		title: _("Warning report on %%", rn.title+' '+rn.suffix)
	});
	$('#nodereport').dialog('open');
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * NodeIterator: iterate over all Node objects
 *
 * opt: object with options to restrict the iteration to specified items only.
 *		Specify project (ID), service (ID), type (string), and/or match (string).
 * Option 'match' is similar to 'type'; 'type' looks for equality, but 'match'
 * looks for either equality or a cloud-type.
 *
 * usage:
 * 		var it = new NodeIterator({service: 1, type: 'tUNK'});
 * 		for (it.first(); it.notlast(); it.next()) {
 			var rn_id = it.getnodeid();
 *			var rn = it.getnode();
 *	 		:
 *		}
 */
var NodeIterator = function(opt) {
	if (opt==null) opt = {};
	/* On initialisation, walk through the Node._all array and store all
	 * matching Nodes in this.item[].
	 */
	this.index = 0;
	this.item = [];
	for (var i in Node._all) {
		var rn = Node._all[i];
		if (opt.project!=undefined && rn.project!=opt.project) continue;
		if (opt.service!=undefined && rn.service!=opt.service) continue;
		if (opt.type!=undefined && rn.type!=opt.type) continue;
		if (opt.match!=undefined && 
			!(rn.type==opt.match
				|| rn.type=='tUNK'
				|| (rn.type!='tACT' && rn.type!='tNOT' && 'tUNK'==opt.match)
			)
		) continue;
		this.item.push(i);
	}
	if (opt.type=='tACT') bugreport('type-option Actor specified','NodeIterator'); 
	if (opt.match=='tACT') bugreport('match-option Actor specified','NodeIterator'); 
};

NodeIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	notlast: function() {return (this.index < this.item.length);},
	getnode: function() {return Node._all[ this.item[this.index] ];},
	getnodeid: function() {return this.item[this.index] ;},
	sortByName: function() {
		this.item.sort( function(a,b) {
			var na = Node.get(a);
			var nb = Node.get(b);
			var ta = na.title+na.suffix;
			var tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	},
	sortByType: function() {
		this.item.sort( function(a,b) {
			var na = Node.get(a);
			var nb = Node.get(b);
			if (na.type<nb.type)  return -1;
			if (na.type>nb.type)  return 1;
			// When types are equal, sort alphabetically
			var ta = na.title+na.suffix;
			var tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	},
	sortByLevel: function() {
		this.item.sort( function(a,b) {
			var na = Node.get(a);
			var nb = Node.get(b);
			var ca = Component.get(na.component);
			var cb = Component.get(nb.component);
			var va = ThreatAssessment.valueindex[ca.magnitude];
			var vb = ThreatAssessment.valueindex[cb.magnitude];
			if (va==1)  va=8; // Ambiguous
			if (vb==1)  vb=8;
			if (va!=vb)  return vb - va;
			// When levels are equal, sort alphabetically
			var ta = na.title+na.suffix;
			var tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	}	
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * Rules: an object that contains all rules for a valid diagram.
 *
 * Rules.consistent() must return true, and should be checked at startup.
 */
var Rules = {
	/* English translations of node types.
	 * Can also be used as enumerator:   for (var t in Rules.nodetypes) { ... }
	 */
	nodetypes: {'tWLS': _("wireless link"),'tWRD': _("wired link"), 'tEQT': _("equipment"),'tACT': _("actor"), 'tUNK': _("cloud"), 'tNOT': _("note")},
	/* per nodetype, minimum number of that type to appear in a diagram.
	 * There is no maximum.
	 */
	minnode: {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 2,'tUNK': 0,'tNOT': 0},
	/* per nodetype, the minimum number of edges to each of the other nodetypes.
	 * if node A cannot connect to node B, both the minimum and the maximum numer
	 * will be zero.
	 */
	edgeMin: {
		'tWLS': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0},
		'tWRD': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0},
		'tEQT': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0},
		'tACT': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0},
		'tUNK': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0},
		'tNOT': {'tWLS': 0,'tWRD': 0,'tEQT': 0,'tACT': 0,'tUNK': 0,'tNOT': 0}
	},
	/* per nodetype, the maximum number of edges to each of the other nodetypes.
	 * Set to 99 for a (practically) unlimited number of edges.
	 * Set to 0 if no edge to that node-type is allowed.
	 */
	edgeMax: {
		'tWLS': {'tWLS':  0,'tWRD':  0,'tEQT': 99,'tACT':  0,'tUNK': 99,'tNOT': 0},
		'tWRD': {'tWLS':  0,'tWRD':  0,'tEQT':  2,'tACT':  0,'tUNK':  2,'tNOT': 0},
		'tEQT': {'tWLS': 99,'tWRD': 99,'tEQT':  0,'tACT': 99,'tUNK': 99,'tNOT': 0},
		'tACT': {'tWLS':  0,'tWRD':  0,'tEQT': 99,'tACT':  0,'tUNK': 99,'tNOT': 0},
		'tUNK': {'tWLS': 99,'tWRD': 99,'tEQT': 99,'tACT': 99,'tUNK': 99,'tNOT': 0},
		'tNOT': {'tWLS':  0,'tWRD':  0,'tEQT':  0,'tACT':  0,'tUNK':  0,'tNOT': 0}
	},
	/* per nodetype, the minimum number of edges in total for a single node */
	totaledgeMin: {
		'tWLS': 2,
		'tWRD': 2,
		'tEQT': 1,
		'tACT': 1,
		'tUNK': 1,
		'tNOT': 0
	},
	/* per nodetype, the maximum number of edges in total, or 99 for unlimited. */
	totaledgeMax: {
		'tWLS': 99,
		'tWRD':  2,
		'tEQT': 99,
		'tACT': 99,
		'tUNK': 99,
		'tNOT': 0
	},
	/* Check whether the rules for a given type are consistent. If called without
	 * an argument it will check all types.
	 */
	consistent: function(t) {
		var i;
		if (!t) {
			var rv = true;
			for (i in Rules.nodetypes) rv = rv && Rules.consistent(i);
			return rv;
		}
		
		if (Rules.totaledgeMin[t] > Rules.totaledgeMax[t])  return false;
		for (i in Rules.nodetypes) {
			if (Rules.edgeMin[t][i] > Rules.edgeMax[t][i])  return false;
			if (Rules.edgeMax[t][i] > Rules.totaledgeMax[t])  return false;
			if ((Rules.edgeMax[t][i]==0 || Rules.edgeMax[i][t]==0) &&
				Rules.edgeMax[t][i] != Rules.edgeMax[i][t]) {
				return false;
			}
		}
			
		var edgeMinT = 0;
		for (i in Rules.nodetypes) edgeMinT += Rules.edgeMin[t][i];
		if (edgeMinT > Rules.totaledgeMin[t])  return false;

		var edgeMaxT = 0;
		for (i in Rules.nodetypes) {
			if (edgeMaxT<99) {
				if (Rules.edgeMax[t][i]<99) {
					edgeMaxT += Rules.edgeMax[t][i];
				} else {
					edgeMaxT = 99;
				}
			}
		}
		
		if (edgeMaxT < Rules.totaledgeMax[t])  return false;

		if (edgeMinT > edgeMaxT)  return false;

		if (edgeMaxT==99 && Rules.totaledgeMax[t]<99)  return false;
			
		return true;	
	}
};
