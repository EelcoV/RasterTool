/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * $Id: rasterNode.js,v 1.1.1.1.4.7.2.5.2.11 2013/07/18 19:52:23 vriezekolke Exp $
 *
 * Node: an element in a telecom service diagram
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all: array of all Node elements, indexed by id
 *	_currindex: sequence number for auto-generated IDs
 *	DialogNode: id of the node currently beingreported in the warning report window (#nodereport)
 *	MenuNode: Node for which the popup menu has appeared
 *	get(i): returns the object with id 'i'.
 *	projecthastitle(p,str): project 'p' has a node with title 'str'.
 *	servicehastitle(s,str): service 's' has a node with title 'str'.
 * Instance properties:
 *	type: one of 'tWLS','tWRD','tEQT','tACT','tUNK', 'tNOT'
 *	title: name of the node
 *	suffix: letter a,b,c... to distiguish nodes with the same title (set by Component)
 *	id: unique number
 *	component: component object for this node
 *	nid: node ID (id of the DOM element)
 *	jnid: node ID in jQuery format (#id of the DOM element)
 *	service: ID of the service to which this node belongs
 *	position: current position on workspace, and size {x,y,width,height}
 *	dragpoint: jsPlumb endpoint from which to drag new connectors
 *	centerpoint: jsPlumb endpoint to which connectors are attached
 *	connect[]: array over Node id's of booleans, indicating whether this
 *		Node is connected to each other Node.
 *	_normw: normal width (default width)
 *	_normh: normal height (default height)
 * Methods:
 *	destroy(): destructor.
 *	setposition(x,y): set the position of the HTML document object to (x,y).
 *	settitle(str): sets the header text to 'str'.
 *	htmltitle(): returns this title, properly html formatted when the node has a suffix (except for css classes)
 *	edgecount(cn): counts the number of edges to nodes of each type
 *		cn (optional) is the jsPlumb list of all connections.
 *	edgeUnderflow(es): determines to which node-types connections can still
 *		be allowed. es (optional) is the result from a preview edgecount
 *	getreport(es): returns a array of strings describing which connection
 *		rules are violated, in normal English. es is optional
 *	connectionsOK(es): returns whether all connection rules are obeyed
 *		es is optional
 *	setmarker(cn): sets or hides the rule violation marker. cn is optional.
 *	hidemarker(): hides the rule violation marker.
 *	showmarker(): shows the rule violation marker.
 *	try_attach_center(dst): called when this node gets connected to Node dst.
 *	attach_center(dst): create and draw the connector.
 *	detach_center(dst): called when the connection from this node to Node dst
 *		is removed.
 *	addtonodeclusters(): for each of the threats to this component, insert the 
 *		node into the corresponding node cluster.
 *	removefromnodeclusters(): remove this node from all node clusters.
 *	paint(effect): create and show the HTML document object for this node, but 
 *		not its connections. Fade-in if effect==true.
 *	unpaint: hide and remove the HTML document object for this node, including
 *		all its connections.
 *	autosettitle: give this Node a unique title, and create the corresponding
 *		Component object.
 *	_showpopupmenu(x,y): populate and display the popup menu.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var Node = function(type, id) {
	if (id!=null && Node._all[id]!=null)
		bugreport("Node with id "+id+" already exists","Node.constructor");
	this.id = (id==null ? nextUnusedIndex(Node._all) : id);
	this.type = type;
	this.nid = 'node'+this.id;
	this.jnid = '#node'+this.id;
	this.service = Service.cid;
	this.position = {x: 0, y: 0, width: 0, height: 0};
	this.connect = [];
	this._normw = 0;
	this._normh = 0;
	this.component = null;
	this.title = "";
	this.suffix = "";
	// Sticky notes are traditionally yellow
	this.color = (this.type=='tNOT' ? "yellow" : "none");

	this.store();
	Node._all[this.id] = this;
};
Node._all = [];
Node.DialogNode = 0;
Node.MenuNode = 0;
Node.get = function(id) { return Node._all[id]; };
Node.projecthastitle = function(pid,str) {
	for (var i=0,alen=Node._all.length; i<alen; i++) {
		if (!Node._all[i]) continue;
		if (Node._all[i].title==str) {
			var cm = Component.get(Node._all[i].component);
			if (cm.project==pid) return i;
		}
	}
	return -1;
};
Node.servicehastitle = function(sid,str) {
	for (var i=0,alen=Node._all.length; i<alen; i++) {
		if (!Node._all[i]) continue;
		if (Node._all[i].title==str && Node._all[i].service==sid) return i;
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
		if (rn.iscontainedin(sl,st,sw,sh)) 
			a.push(rn.id);
	}
	return a;
};
Node.destroyselection = function () {
	var a = Node.nodesinselection();
	for (var i=0; i<a.length; i++) {
		var rn = Node._all[a[i]];
		rn.destroy();
	}
};

Node.prototype = {
	destroy: function(effect) {
		if (this.centerpoint) jsPlumb.deleteEndpoint(this.centerpoint);
		if (this.dragpoint) jsPlumb.deleteEndpoint(this.dragpoint);
		if (this.component!=null) {
			var cm = Component.get(this.component);
			cm.removenode(this.id);
		}

		if (this.id==Node.DialogNode) 
			$('#nodereport').dialog("close");
		if (this.component==Component.ThreatsComponent) 
			$('#componentthreats').dialog("close");
		var neighbours = this.connect.slice(0); // duplicate the array
		for (var i=0; i<neighbours.length; i++) {
			var nb = Node.get(neighbours[i]);
			this.detach_center( nb );
			nb.setmarker();
			if (Node.DialogNode==nb.id) RefreshNodeReportDialog();
		}
		
		this.removefromnodeclusters();
		
		localStorage.removeItem(LS+'N:'+this.id);
		this.hidemarker();  // Make it disappear before the animation starts
		$('#tinynode'+this.id).remove();
		if (effect==undefined || effect==true) 
			$(this.jnid).effect("explode", 500, function() {
				var id = nid2id(this.id);
				$('#node'+id).remove();
				Node._all[id]=null;
			});
		else {
			$('#node'+this.id).remove();
			Node._all[this.id]=null;
		}
	},
	
	changetype: function(typ) {
		if (this.type=='tNOT')
			bugreport("Attempt to change the type of a note","Node.changetype");
		var i;
		var newn = new Node(typ);
		newn.position.x = this.position.x;
		newn.position.y = this.position.y;
		newn.position.w = 0;
		newn.position.h = 0;
		newn.position.v = 0;
		newn.position.g = 0;
		newn.service = this.service;
		newn.changetitle(this.title);
		newn.store();
		newn.paint(false);
		for (i=0; i<this.connect.length; i++)
			newn.attach_center(
				Node._all[this.connect[i]] 
			);
//		switch (newn.type) {
//		case 'tACT':
//			// Do nothing
//			break;
//		case 'tUNK':
//			// TODO: Try to move threat assessments over
//		default:
//			// Only add to node clusters if its component is not 'singular'
//			var cm = Component.get(newn.component);
//			if (!cm.single)
//				newn.addtonodeclusters();
//		}
		this.destroy(false);
		jsPlumb.repaint(this.nid);
	},
	
	setposition: function(px,py,snaptogrid) {
		var r = $('#tab_diagrams').position();
		var fh = $('.fancyworkspace').height();
		var fw = $('.fancyworkspace').width();
		var oh = $('#scroller_overview'+this.service).height();
		var ow = $('#scroller_overview'+this.service).width();
		var dO = {};
		if (snaptogrid==null)
			snaptogrid = Preferences.grid;
		
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
		$(this.jnid).css("left",px+"px").css("top",py+"px");
		jsPlumb.repaint(this.nid);
		
		dO.left = (px * ow)/fw;
		dO.top = (py * oh)/fh;
		$('#tinynode'+this.id).css('left', dO.left);
		$('#tinynode'+this.id).css('top', dO.top);
	},
	
	setcomponent: function(c) {
		if (this.type=='tNOT')
			bugreport("Attempt to attach component to a note","Node.setcomponent");
		this.component = c;
		this.store();
	},
	
	autosettitle: function(newtitle) {
		if (!newtitle)
			newtitle = Rules.nodetypes[this.type];
		var targettitle = newtitle;
		var n=0;
		if (this.type=='tNOT') {
			this.settitle(targettitle);
		} else if (this.type=='tACT') {
			while (Node.servicehastitle(Service.cid,targettitle)!=-1)
				targettitle = newtitle + ' (' + (++n) + ')';
			this.settitle(targettitle);
		} else {
			while (Node.projecthastitle(Project.cid,targettitle)!=-1)
				targettitle = newtitle + ' (' + (++n) + ')';
			var c = new Component(this.type);
			c.adddefaultthreatevaluations();
			c.addnode(this.id);
			c.settitle(targettitle);
		}
	},

	changetitle: function(str) {
		str = trimwhitespace(str);
		if (str==this.title)
			return;
		if (str=="") {
			// Blank title is not allowed. Retain current title.
			return;
		}
		// Notes can be identical (can have the same 'title').
		if (this.type=='tNOT') {
			this.settitle(str);
			return;
		}
		// Actors don't have (nor need) components, since they have no threat evaluations
		if (this.type=='tACT') {
			var i=0;
			var targettitle = str;
			// If there is an actor "abc" and an actor "abc (1)", then renaming that second actor
			// to "abc" should not result in a name "abc (2)"
			this.title="NoSuchNameNoSuchNameNoSuchNameNoSuchName";
			while (Node.servicehastitle(Service.cid,targettitle)!=-1) {
				// dummy comment
				targettitle = str + ' (' + (++i) + ')';
			}
			this.settitle(targettitle);
			RefreshNodeReportDialog();
			return;
		}
		var prevcomponent = null;
		if (this.component!=null) {
			if (!Component.get(this.component))
				bugreport("no such component","Node.changetitle");
			prevcomponent = Component.get(this.component);
		}
		// See if there is an existing component with this title & type
		var n = Component.hasTitleTypeProject(str,this.type,Project.cid);
		if (n==-1) {
			// Create a new component, and link it to this node
			var c = new Component(this.type);
			c.adddefaultthreatevaluations(this.component);
			c.addnode(this.id);
			c.settitle(str);
		} else {
			// The new name of this node matches an existing Component.
			// add this node to that component
			Component.get( n ).addnode(this.id);
		}
		if (prevcomponent) prevcomponent.removenode(this.id);
		RefreshNodeReportDialog();
	},

	settitle: function(str,suff) {
		this.title=str;
		this.suffix=(suff==null ? "" : suff);
		if (this.component!=null) {
			var cm = Component.get(this.component);
			$('#nodetitle'+this.id).removeClass('marktitleM marktitleS');
			if (cm.nodes.length>1) {
				$('#nodetitle'+this.id).addClass( (cm.single?'marktitleS':'marktitleM') );
			}
		}
		$('#titlemain'+this.id).html(H(this.title));
		$('#titlesuffix'+this.id).html(this.suffix=="" ? "" : "&thinsp;<sup>"+this.suffix+"</sup>");
		this.store();
	},
	
	htmltitle: function() {
		return H(this.title) + (this.suffix!='' ? '<sup>&thinsp;'+this.suffix+'</sup>' : '');
	},
	
	edgecount: function (cn) {
		var C = {'tWLS':0, 'tWRD':0, 'tEQT':0, 'tACT':0, 'tUNK':0, 'TOTAL':0};
		var conn = (cn ? cn : jsPlumb.getConnections({scope:'center'}));
		for (var i=0; i<conn.length; i++) {
			/* Use conn[i].xxxx, where xxxx is one of:
			 * sourceId, targetId, source, target, sourceEndpoint, targetEndpoint, connection
			 */
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
	
	edgeUnderflow: function(C) {
		var opt = [];
		for (var t in Rules.nodetypes) {
			if (t!='TOTAL' && C[t]<Rules.edgeMax[this.type][t]) opt.push(Rules.nodetypes[t]);
		}
		return opt;
	},
	
	getreport: function (es) {
		function plural_s(str,num) { return (num==1 ? str : (str+'s')); }
		var report = [];
		var C = (es ? es : this.edgecount() );
		if (C['TOTAL']<Rules.totaledgeMin[this.type]) {
			var toolittle = Rules.totaledgeMin[this.type]-C['TOTAL'];
			var unlimited = (Rules.totaledgeMax[this.type]==99);
			var options = arrayJoinAsString(this.edgeUnderflow(C), "or");
			report.push( 
				"Must have " + 
				(unlimited ? "at least " : "")+ 
				Rules.totaledgeMin[this.type] +
				plural_s(" connection",Rules.totaledgeMin[this.type]) + " (you have " + 
					(C['TOTAL']>0 ? "only "+C['TOTAL'] : "none") + 
				"). " +
				"Add " + toolittle + plural_s(" connection",toolittle) + 
				" to a " + options + "."
			);
		}
		if (C['TOTAL']>Rules.totaledgeMax[this.type]) {
			var toomany = C['TOTAL'] - Rules.totaledgeMax[this.type];
			report.push( 
				"Can have at most " + Rules.totaledgeMax[this.type] +
				plural_s(" connection",Rules.totaledgeMax[this.type]) + " (you have " + C['TOTAL'] + "). " +
				"Remove " + toomany + plural_s(" connection",toomany) + 
				" to " + (toomany==1?"a ":"") +"neighbouring " + plural_s("node",toomany) + "."
			);
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
			report.push(
				(mustadd.length==1 ? "A connection " : "Connections ") +
				"must be added to " +
				(mustadd.length==1 ? "a node of type " : "nodes of type ") +
				(mustadd.length==1 ? mustadd[0] : arrayJoinAsString(mustadd,"and")) + "."
			);
		}
		if (mustremove.length>0) {
			report.push(
				(mustremove.length==1 ? "A connection " : "Connections ") +
				"must be removed from " +
				(mustremove.length==1 ? "a node of type " : "nodes of type ") +
				(mustremove.length==1 ? mustremove[0] : arrayJoinAsString(mustremove,"and")) + "."
			);
		}
		
		return report;
	},
	
	connectionsOK: function(es) {
		var C = (es ? es : this.edgecount() );
		if (C['TOTAL']<Rules.totaledgeMin[this.type])
			return false;
		if (C['TOTAL']>Rules.totaledgeMax[this.type] && Rules.totaledgeMax[this.type]>-1)
			return false;
		for (var j in C) {
			if (C[j]<Rules.edgeMin[this.type][j])
				return false;
			if (C[j]>Rules.edgeMax[this.type][j] && Rules.edgeMax[this.type][j]>-1)
				return false;
		}
		return true;
	},
	
	setmarker: function(cn) {
		if (this.type=='tNOT')
			return;
		var es = this.edgecount( (cn ? cn : jsPlumb.getConnections({scope:'center'})) );
		if (!this.connectionsOK(es)) {
			$('#nodeMagnitude'+this.id).hide();
			this.showmarker();
		} else {
			if (this.component!=null) {
				var m = Component.get(this.component).magnitude;
				var mi = ThreatAssessment.valueindex[m];
				$('#nodeMagnitude'+this.id).text(m);
				$('#nodeMagnitude'+this.id).removeClass("M0 M1 M2 M3 M4 M5 M6 M7").addClass("M"+mi);
				$('#nodeMagnitude'+this.id).attr("title",ThreatAssessment.descr[mi]);
				$('#nodeMagnitude'+this.id).show();
			}
			this.hidemarker();
		}
	},

	hidemarker: function() {
		$('#nodeW'+this.id).removeClass("markhi").addClass("marklo");
	},
	
	showmarker: function() {
		$('#nodeW'+this.id).removeClass("marklo").addClass("markhi");
	},
	
	setlabel: function(str) {
		$('#nodeheader'+this.id).removeClass(this.color);
		this.color = str;
		this.store();
		$('#nodeheader'+this.id).addClass(this.color);
		if (Preferences.label) 
			$('#nodecontents'+this.id+' img').attr("src", "../img/"+this.color+"/"+this.type+".png");
		else
			$('#nodeheader'+this.id).addClass("Chide");
	},
	
	try_attach_center: function(dst) {
		var C = this.edgecount();
		/* Node has C['TOTAL'] edges, C[t] per type t; this includes one edge
		 * to the node of type dst.type.
		 * Disallow the edge only if either the maximum total number of edges,
		 * or the maximum number of edges to nodes of type dst.type has been
		 * exceeded.
		 */
		//if (jQuery.inArray(dst.id,this.connect)>-1) {
			/* Already connected. Detach the newly attached connection
		  	 * without visual feedback.
		  	 */
			// Line below no longer necessary for jsPlumb 1.5.5, and causes an error if present
		  	//this.dragpoint.detachAll();
		//} else
		if (C['Total']>Rules.totaledgeMax[this.type]
		  || C[dst.type]>=Rules.edgeMax[this.type][dst.type] ) {
		  	/* detach the newly attached connection, and flash the element for
		  	 * visual feedback.
		  	 */
		  	$(this.jnid).effect("pulsate", { times:2 }, 200);
		  	$(dst.jnid).effect("pulsate", { times:2 }, 200);
			// Line below no longer necessary for jsPlumb 1.5.5, and causes an error if present
		  	//this.dragpoint.detachAll();
		} else {
		 	/* Move the begin and endpoints to the center points */
			// Line below no longer necessary for jsPlumb 1.5.5, and causes an error if present
		  	//this.dragpoint.detachAll();
		  	this.attach_center(dst);
			transactionCompleted("Node connect");
		 }
	},
	
	attach_center: function(dst) {
		var edge = jsPlumb.connect({
			sourceEndpoint: this.centerpoint,
			targetEndpoint: dst.centerpoint,
			connector: "Straight",
			overlays: [[ "Label", {
					label: "⊗",
					cssClass: "connbutton",
					events: {
						dblclick: function(labelOverlay, originalEvent) {
							var node1 = labelOverlay.component.sourceId;
							var node2 = labelOverlay.component.targetId;
							jsPlumb.detach(labelOverlay.component);
							Node.get(nid2id(node1)).detach_center(Node.get(nid2id(node2)));
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
		RefreshNodeReportDialog();
	},
	
	detach_center: function(dst) {
		var i;
		i = this.connect.indexOf(dst.id);
		if (i==-1) bugreport('incorrect connection info','Node.detach_center');
		this.connect.splice( i,1 );
		i = dst.connect.indexOf(this.id);
		if (i==-1) bugreport('incorrect connection info','Node.detach_center');
		dst.connect.splice( i,1 );		
		this.store();
		dst.store();
		var getcon = jsPlumb.getConnections({scope:'center'});
		this.setmarker(getcon);
		dst.setmarker(getcon);
		RefreshNodeReportDialog();
	},

	addtonodeclusters: function() {
		if (this.component==null)
			bugreport("Node's component has not been set","Node.addtonodeclusters");
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
				if (nc.childclusters.length==0 && nc.childnodes.length==0 && nc.parentcluster==null)
					nc.destroy();
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
	
	paint: function(effect) {
		if (this.position.x<0 || this.position.y<0
		 || this.position.x>3000 || this.position.y>3000) {
		 	bugreport("extreme values of node '"+H(this.title)+"' corrected", "Node.paint");
		 	this.position.x = 100;
		 	this.position.y = 100;
		 	this.store();
		 }
		var str = '\n\
			<div id="node_ID_" class="node _TY_">\n\
				<div id="nodecontents_ID_" class="nodecontent _TY_content"><img src="../img/_CO_/_TY_.png" class="contentimg"></div>\n\
				<div id="nodeheader_ID_" class="nodeheader _TY_header _CO_">\n\
				  <div id="nodetitle_ID_" class="nodetitle _TY_title"><span id="titlemain_ID_"></span><span id="titlesuffix_ID_"></span></div>\n\
				</div>\n\
				<img id="nodeC_ID_" class="nodeC _TY_D" src="../img/dropdown.png">\n\
				<img id="nodeW_ID_" class="nodeW _TY_W" src="../img/warn.png">\n\
				<div id="nodeMagnitude_ID_" class="nodeMagnitude _TY_Magnitude"></div>\n\
			</div>\n\
			';
		str = str.replace(/_ID_/g, this.id);
		str = str.replace(/_TY_/g, this.type);
		str = str.replace(/_CO_/g, (Preferences.label ? this.color : "none"));
//		str = str.replace(/_DE_/g, Rules.nodetypes[this.type]);
		$('#diagrams_workspace'+this.service).append(str);
		this.setmarker();

		str = '<div id="tinynode_ID_" class="tinynode"></div>\n';
		str = str.replace(/_ID_/g, this.id);
		$('#scroller_overview'+this.service).append(str);

		if (this.position.width==0) {
			this.position.width=$(this.jnid).width();
			this.position.height=$(this.jnid).height();
		} else {
			$(this.jnid).width(this.position.width);
			$(this.jnid).height(this.position.height);
		}
		if (this.component!=null) {
			var cm = Component.get(this.component);
			cm.setmarkeroid(null);
			$('#nodetitle'+this.id).removeClass('marktitleS marktitleM');
			if (cm.nodes.length>1) {
				$('#nodetitle'+this.id).addClass( (cm.single?'marktitleS':'marktitleM') );
			}
		}
		$('#titlemain'+this.id).html(H(this.title));
		$('#titlesuffix'+this.id).html(this.suffix=="" ? "" : "&thinsp;<sup>"+this.suffix+"</sup>");
		
		if (effect==undefined || effect==true)
			$(this.jnid).fadeIn(500);
		else
			$(this.jnid).css("display", "block");
		this.setposition(this.position.x, this.position.y, false);
		var containmentarr = [];
//		$(this.jnid).draggable({
		jsPlumb.draggable($(this.jnid), {
			containment: 'parent',
			distance: 10,	// prevent drags when clicking the menu activator
			opacity: 0.8,
			//helper: 'clone',
			stop: function(event,ui) {
				// Reset the node to the grid, if necessary
				var rn = Node.get( nid2id(this.id) );
				rn.setposition(rn.position.x,rn.position.y);
				transactionCompleted("Node move (selection)");
			},
			drag: function(event,ui) {
				var rn = Node.get( nid2id(this.id) );
//				var r = $('#diagrams_workspace'+rn.service).position();
				var r = $('#tab_diagrams').offset();
				var sl = $('#diagrams'+rn.service).scrollLeft();
				var st = $('#diagrams'+rn.service).scrollTop();
				var dx = (ui.offset.left-r.left+sl) - rn.position.x;
				var dy = (ui.offset.top-r.top+st) - rn.position.y;
				if (event.shiftKey) {
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
			this.dragpoint = jsPlumb.addEndpoint(this.nid, {
				anchor: "TopCenter",
				isSource: true,
				isTarget: false,
				endpointsOnTop: true,
				maxConnections: -1,
				container: this.nid,
				dragOptions: {opacity: 0.1}  // a ghost appears next to the dragged dot otherwise
			}); 
			$(this.dragpoint.canvas).css({visibility: "hidden"});
			this.centerpoint = jsPlumb.addEndpoint(this.nid, {
				anchor: "Center",
				paintStyle: {fillStyle:"transparent"},
				isSource: false,
				isTarget: false,
				endpointsOnTop: false,
				maxConnections: -1, // unlimited
				scope: 'center'
			});
			// Drop connections onto the target node, not just on the dragpoint of the target node.
			jsPlumb.makeTarget(this.nid, {
				// endpoints will be deleted/hidden in rasterNode.js:initTabDiagrams:connfunction
				deleteEndpointsOnDetach: false
			});
		}

		$(this.jnid).hover( function() {
			var id = nid2id(this.id);
			$('#nodeC'+id).css({visibility: "visible"});
			if (Node.get(id).dragpoint) $(Node.get(id).dragpoint.canvas).css({visibility: "visible"});
			if (Preferences.emsize=="em_none")
				$('#nodeMagnitude'+id).addClass('doshow'); 
		},function() {
			var id = nid2id(this.id);
			$('#nodeC'+id).css({visibility: "hidden"});
			if (Node.get(id).dragpoint) $(Node.get(id).dragpoint.canvas).css({visibility: "hidden"});
			$('#nodeMagnitude'+id).removeClass('doshow'); 
		});
		
		$(this.jnid).bind('contextmenu', function(e) {
			e.preventDefault();
			var rn = Node.get(nid2id(this.id));
			rn._showpopupmenu(e.clientX+2,e.clientY-5);
			return false;
		});
		
		$('#nodeC'+this.id).mousedown( function(e){
			var rn = Node.get(nid2id(this.id));
			var offset = $(this).offset();
			rn._showpopupmenu(offset.left+16,offset.top+5);
			return false;
		});
		$('#nodeC'+this.id).click( function(e){ return false; });
		
		$("#nodeW"+this.id).click(function() {
			// this.id is like "nodeWxxx", where xxx is the node id number
			var id = nid2id(this.id);
			var rn = Node.get(id);
			var report = rn.getreport();
			var s;
			
			if (report.length==0)
				s = "Node is OK; there are no warnings.";
			else {
				s = report.join("<p>");
			}
			$("#nodereport").html( s );
			$("#nodereport").dialog({
				title: 'Warning report on '+rn.htmltitle(),
				zIndex: 400
			});
			$("#nodereport").dialog("open");
			Node.DialogNode = id;
			return false;
		});
	
		$('#titlemain'+this.id).editInPlace({
			bg_over: "rgb(255,204,102)",
			callback: function(domid, enteredText) { 
				var rn = Node.get( nid2id(domid) );
				rn.changetitle(enteredText);
				rn.store();
				transactionCompleted("Node rename");
				return H(rn.title);
			}
		});
		
		/* Unfortunately, must set both min/max width and min/max height, even
		 * though aspectRatio=true. Obtain the current values, and allow double
		 * for maximum
		 */
		if (this._normw==0) this._normw = $(this.jnid).width();
		if (this._normh==0) this._normh = $(this.jnid).height();
		$("#node"+this.id).resizable({
			handles: 'se',
			autoHide: true,
			//containment: '#workspace',//is buggy?
			aspectRatio: true,
			minWidth: this._normw,
			maxWidth: 2*this._normw,
			minHeight: this._normh,
			maxHeight: 2*this._normh,
			resize: function(event,ui) {
				var rn = Node.get( nid2id(this.id) );
				rn.position.x -= (ui.size.width-rn.position.width)/2;
				rn.position.y -= (ui.size.height-rn.position.height)/2;
				rn.position.width=ui.size.width;
				rn.position.height=ui.size.height;
				rn.setposition(rn.position.x,rn.position.y);
			},
			stop: function () { 
				// Reset the node to the grid, if necessary
				var rn = Node.get( nid2id(this.id) );
				rn.setposition(rn.position.x,rn.position.y);
				transactionCompleted("Node resize");
			}
		});
	},
	
	unpaint: function() {
		if (this.centerpoint) jsPlumb.deleteEndpoint(this.centerpoint);
		if (this.dragpoint) jsPlumb.deleteEndpoint(this.dragpoint);

		if (this.id==Node.DialogNode) 
			$('#nodereport').dialog("close");
		$(this.jnid).remove();
		$('#tinynode'+this.id).remove();
	},

	_showpopupmenu: function(x,y) {
		var p = Project.get(Project.cid);
		var cm = Component.get(this.component);
		$('#nodemenu').css("left", x);
		$('#nodemenu').css("top", y);
		$('.popupmenuitem').removeClass('menuhigh popupmenuitemdisabled');
		$('.popupsubmenu').hide();
		if (this.type=='tNOT') {
			$('#mi_th').addClass('popupmenuitemdisabled');
			$('#mi_ct').addClass('popupmenuitemdisabled');
		}
		if (this.type=='tACT')
			$('#mi_th').addClass('popupmenuitemdisabled');
		if (cm==null || cm.nodes.length<2)
			$('#mi_sm').addClass('popupmenuitemdisabled');
		$('#mi_sm>span').html(cm!=null && cm.single ? "Make class" : "Make single");
		populateLabelMenu();
		var s=p.strToLabel(this.color);
		if (s=="")
			s = "Label";
		else
			s = '"' + s + '"';
//		s += '<span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span>';
		$('#mi_cc .labeltext').html(s);
//		$('#nodemenu').attr('style','');
		$('#nodemenu').css("display", "block");
		// Remove any previous custom style
		var limit = $('#diagrams'+Service.cid).offset().top + $('#diagrams'+Service.cid).height();
		var o = $('#nodemenu').offset();
		// Make sure that the submenu is fully visible
		if (o.top + $('#nodemenu').height() > limit) {
			// -5 to make the node menu not the same distance from the bottom of the screen as the label submenu
			o.top = limit - $('#nodemenu').height() - 5;
		 	$('#nodemenu').offset(o);
		} 
		Node.MenuNode = this.id;
	},
	
	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.l=this.title;
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
		if (Rules.nodetypes[this.type]==undefined) {
			errors += "Node "+this.id+" has weird type-value "+this.type+".\n";
		}
		if ((this.type=='tACT' || this.type=='tNOT') && this.component!=null)
			errors += "Node "+this.id+" has a component, but should have none.\n";
		if (this.component!=null && Component.get(this.component)==null)
			errors += "Node "+this.id+" has invalid component.\n";
		if (this.position.x<0 || this.position.x>9999 || this.position.y<0 || this.position.y>9999) {
			errors += "Node "+this.id+" has weird position.\n";
		}
		if (this.position.width<0 || this.position.width>999 || this.position.height<0 || this.position.height>999) {
			errors += "Node "+this.id+" has weird size.\n";
		}
		for (var i=0; i<this.connect.length; i++) {
			var rn = Node.get(this.connect[i]);
			if (!rn) {
				errors += "Node "+this.id+" is connected to node "+rn.id+" which does not exist.\n";
				continue;
			}
			if (rn.connect.indexOf(this.id)==-1) {
				errors += "Node "+this.id+" is connected to node "+rn.id+", but not vice versa.\n";
			}
		}
		// If this node is member of a singlular component, and it is not the first node of that component,
		// then this node should not appear in any node cluster
		var cm = Component.get(this.component);
		if (cm && cm.single && cm.nodes[0]!=this.id) {
			var it = new NodeClusterIterator({isroot: true});
			for (it.first(); it.notlast(); it.next()) {
				var nc = it.getNodeCluster();
				if (nc.containsnode(this.id))
					errors += "Node "+this.id+" is member of a singular class, yet appears in cluster '"+nc.title+"'.\n";
			}
		} 
		return errors;
	}
};

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
	for (var i=0,alen=Node._all.length; i<alen; i++) {
		if (!Node._all[i]) continue;
		var rn = Node._all[i];
		if (opt.project!=undefined && Service.get(rn.service).project!=opt.project) continue;
		if (opt.service!=undefined && rn.service!=opt.service) continue;
		if (opt.type!=undefined && rn.type!=opt.type) continue;
		if (opt.match!=undefined && 
			!(rn.type==opt.match 
			 || rn.type=='tUNK' 
			 || (rn.type!='tACT' && 'tUNK'==opt.match)
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
			if (na.type<nb.type) return -1;
			if (na.type>nb.type) return 1;
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
			if (va==1) va=8; // Ambiguous
			if (vb==1) vb=8;
			if (va!=vb)
				return vb - va;
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
	nodetypes: {'tWLS': 'wireless link','tWRD': 'wired link','tEQT': 'equipment','tACT': 'actor','tUNK': 'cloud', 'tNOT': 'note'},
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
		
		if (Rules.totaledgeMin[t] > Rules.totaledgeMax[t])
			return false;
		for (i in Rules.nodetypes) {
			if (Rules.edgeMin[t][i] > Rules.edgeMax[t][i])
				return false;
			if (Rules.edgeMax[t][i] > Rules.totaledgeMax[t])
				return false;
			if ((Rules.edgeMax[t][i]==0 || Rules.edgeMax[i][t]==0) &&
				Rules.edgeMax[t][i] != Rules.edgeMax[i][t])
				return false;
		}
			
		var edgeMinT = 0;
		for (i in Rules.nodetypes) edgeMinT += Rules.edgeMin[t][i];
		if (edgeMinT > Rules.totaledgeMin[t])
			return false;

		var edgeMaxT = 0;
		for (i in Rules.nodetypes) {
			if (edgeMaxT<99) {
				if (Rules.edgeMax[t][i]<99)
					edgeMaxT += Rules.edgeMax[t][i];
				else
					edgeMaxT = 99;
			}
		}
		
		if (edgeMaxT < Rules.totaledgeMax[t])
			return false;

		if (edgeMinT > edgeMaxT)
			return false;

		if (edgeMaxT==99 && Rules.totaledgeMax[t]<99)
			return false;
			
		return true;	
	}
};

