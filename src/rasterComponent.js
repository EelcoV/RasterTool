/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals bugreport, createUUID, Rules, _, isSameString, LS, ThreatAssessment, Transaction, NodeCluster, NodeClusterIterator, prependIfMissing, refreshComponentThreatAssessmentsDialog, trimwhitespace, H */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Component: a physical component, or class of identical components
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all: array of all Node elements, indexed by id
 *	ThreatsComponent: if of the node for which the threats dialog is visible.
 *	get(i): returns the object with id 'i'.
 *	hasTitleTypeProject(str,type,pid): returns the id of the Component object with title 'str',
 *		type 'type' and project 'pid', or -1 if no such Component exists.
 * Instance properties:
 *	type: one of 'tWLS','tWRD','tEQT','tUNK'
 *	id: UUID
 *	title: retrieve current title
 *	project: project to which this component belongs
 *	thrass[]: array of ThreatAssessment id's, holding the threat estimates
 *	nodes[]: array of Node objects that share this component.
 *	magnitude: overall vulnerability of this component
 *	single: true iff the component has a single physical existence (i.s.o. multiple identical copies)
 *	_markeroid: id of DOM object in which evaluation status is shown.
 *	accordionopened: whether the Component accordion needs to be opened in Single Failure view.
 * Methods:
 *	destroy(): destructor.
 *	absorbe(c): merge data from another component into this, then destroy() that other component
 *	mergeclipboard: paste ThreatAssessment.Clipboard into this. Returns the list of new TA's.
 *  repaintmembertitles: ensure all members have unique suffixes, then repaint all members
 *	setclasstitle(str): set title of component and all members to 'str', and update DOM.
 *	changeclasstitle(str): if permitted, sets the header text to 'str'.
 *	setproject(pid): sets the project to pid (numerical).
 *	addnode(n.id, asproxy): add a node to this component. asproxy: if the component is singular
 *		then add this node as it representative in the node clusters.
 *	removenode(n.id): remove the node from this component
 *	addthrass(ta,idx): add the ThreatAssessment object at index idx.
 *	removethrass(te): remove the ThreatAssessment object.
 *  threatdata(): returns do/undo data for threats in thrass.
 *	threatsnotevaluated: returns the numer of threats that have not been evaluated.
 *	adddefaultthreatevaluations(): copy threat evals from another component or checklists.
 *	calculatemagnitude: calculate the overall vulnerability of this component.
 *	setsingle(b): change singular/multiple flag (this.single) to 'b'.
 *	setmarkeroid(oid): change _markeroid and set status.
 *	setmarker: show/hide/set the status marker.
 *  repaint: refresh the UI on the SF tab and the vulnerabilities dialogue
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
*/
var Component = function(type, pid, id) {
	if (!id) {
		console.warn("*** Warning: no id specified for new Component");
	}
	if (type=='tACT') {
		bugreport("attempt to create component for actor node","Component.constructor");
	}
	if (type=='tNOT') {
		bugreport("attempt to create component for a note","Component.constructor");
	}
	if (id!=null && Component._all[id]!=null) {
		bugreport("Component with id "+id+" already exists","Component.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.type = type;
	this.project = pid;
	this.nodes = [];
	this.title = _("Component ") + Rules.nodetypes[this.type] + " " + this.id;
	this.thrass = [];
	this.magnitude = '-';
	this.single = false;
	this._markeroid = null;
	this.accordionopened = false;

	this.store();
	Component._all[this.id] = this;
};
Component._all = new Object();
Component.ThreatsComponent = -1;
Component.get = function(id) { return Component._all[id]; };
Component.hasTitleTypeProject = function(str,typ,pid) {
	for (var i in Component._all) {
		if (isSameString(Component._all[i].title,str)
			&& Component._all[i].type==typ
			&& Component._all[i].project==pid)  return i;
	}
	return -1;
};
Component.prototype = {
	destroy: function() {
		localStorage.removeItem(LS+'C:'+this.id);
		if (this.id==Component.ThreatsComponent) {
			$('#componentthreats').dialog('close');
		}
		for (const thid of this.thrass) ThreatAssessment.get(thid).destroy();
		delete Component._all[this.id];
	},

	absorbe: function(cm) {
		// Merge all new threvals from cm into this. If both contain a threat with the
		// same name, then use the worst values from each
		for (const thid of cm.thrass) {
			var ta =  ThreatAssessment.get(thid);
			for (var j=0; j<this.thrass.length; j++) {
				var ta2 = ThreatAssessment.get(this.thrass[j]);
				if (isSameString(ta2.title,ta.title)) break;
			}
			if (isSameString(ta.title,ta2.title)) {
				// This component has a threat ta2 with the same name as the one absorbed.
				ta2.setfreq( ThreatAssessment.worst(ta.freq,ta2.freq) );
				ta2.setimpact( ThreatAssessment.worst(ta.impact,ta2.impact) );
			} else {
				ta2 = new ThreatAssessment(ta.type);
				ta2.component = this.id;
				ta2.title = ta.title;
				ta2.description = ta.description;
				ta2.freq = ThreatAssessment.worst(ta.freq,'-');
				ta2.impact = ThreatAssessment.worst(ta.impact,'-');
				ta2.remark = ta.remark;
				ta2.computetotal();
				ta2.store();
				this.thrass.push(ta2.id);
				this.calculatemagnitude();
				// Existing nodes in this component need to be added to the NodeCluster to ta2
				// Add only the first node for 'singular' components, and all nodes for normal components
				for (j=0; j<(this.single?1:this.nodes.length); j++) {
					var rn = Node.get(this.nodes[j]);
					NodeCluster.addnode_threat(this.project,rn.id,ta2.title,ta2.type);
				}
			}
		}
		// Move nodes over from cm into this
		for (const nid of cm.nodes) this.addnode(nid);
		cm.repaintmembertitles();
		cm.nodes = [];
		cm.destroy();
	},

	mergeclipboard: function() {
		var newte = [];
		for (const clip of ThreatAssessment.Clipboard) {
			if (clip.y=='tUNK') {
				bugreport("Wrong type in clipboard data","Component.mergeclipboard");
			}
			// Try to find an identically named threat in our current list. If we are an
			// unknown link, then also the type must match. For types wireless/wired/eqt the
			// type will be converted to this.type anyway, so don't require the types to match.
			// Break as soon as we find a match.
			for (var i=0; i<this.thrass.length; i++) {
				var te = ThreatAssessment.get(this.thrass[i]);
				if (isSameString(clip.t,te.title)
					&& (this.type!='tUNK' || clip.y==te.type)
				) break;
			}
			if (i==this.thrass.length) {
				// Create a new threat evaluation
				// If we are an unknown link, then the type of our threats can (and should) be differet from
				// our own type. For wireless/wired/eqt, the threat type must be converted to our type.
				var th = new ThreatAssessment( (this.type=='tUNK' ? clip.y : this.type) );
				th.setcomponent(this.id);
				this.thrass.push(th.id);
				th.settitle(clip.t);
				th.setdescription(clip.d);
				th.setfreq(clip.p);
				th.setimpact(clip.i);
				th.setremark(clip.r);
				newte.push(th.id);
			} else {
				// Paste into existing threat evaluation
				te.description = prependIfMissing(clip.d, te.description);
				// If neither one is set, the result will be '-'.
				// If one is '-' but the other isn't, the result will be that non '-' value.
				// If both are set, the result will be the worst of both.
				if (te.freq=='-') {
					te.setfreq(clip.p);
				} else if (clip.p=='-') {
					/* Do nothing */
				} else {
					te.setfreq( ThreatAssessment.worst(clip.p,te.freq) );
				}

				if (te.impact=='-') {
					te.setimpact(clip.i);
				} else if (clip.i=='-') {
					/* Do nothing */
				} else {
					te.setimpact( ThreatAssessment.worst(clip.i,te.impact) );
				}
				
				te.remark = prependIfMissing(clip.r, te.remark);
			}
		}
		this.store();
		return newte;
	},

	// Called with no argument, or with argument '1': returns a string of an unused suffix
	// Called with a numerical argument >1, returns an array of unused suffixes
	newsuffix: function(n) {
		function _newsuffix(cm,except) {
			let j;
			let sfx = [];
			for (const n of cm.nodes) sfx.push(Node.get(n).suffix);

			for (j=0; j<26; j++) {
				var chr = String.fromCharCode(String('a').charCodeAt(0)+j);
				if (sfx.indexOf(chr)==-1 && except.indexOf(chr)==-1) break;
			}
			if (j==26) {
				// This is silly. There are more than 26 members in the node class!
				// Find a random number to fit.
				for (;;) {
					chr = '#' + Math.floor(Math.random()*100000);
					if (sfx.indexOf(chr)==-1 && except.indexOf(chr)==-1) break;
				}
			}
			return chr;
		}

		if (!n || n==1) {
			return _newsuffix(this,[]);
		}
		let arr = [];
		while (n>0) {
			arr.push( _newsuffix(this,arr) );
			n--;
		}
		return arr;
	},

	changeclasstitle: function(str) {
		str = trimwhitespace(str);
		// Blank title is not allowed. Retain current title.
		if (str==this.title || str=='')  return;

		new Transaction('classTitle',
			[{id: this.id, title: this.title}],
			[{id: this.id, title: str}],
			_("Rename class")
		);
	},

	setclasstitle: function(str) {
		this.title = str;
		this.repaintmembertitles();
		this.store();
	},

	repaintmembertitles: function() {
		// First: ensure that all suffixes are unique
		if (this.nodes.length>1 && !this.single) {
			let i, j;
			for (i=0; i<this.nodes.length; i++) {
				let rn = Node.get(this.nodes[i]);
				// Check if another node already has this suffix
				for (j=0; j<i; j++) {
					var othn = Node.get(this.nodes[j]);
					if (rn.suffix==othn.suffix) break;
				}
				if (j<i || rn.suffix=='')  rn.suffix = this.newsuffix();
			}
		}
		// Second: repaint all member titles. This will do .store() on all member nodes
		for (const n of this.nodes) Node.get(n).settitle(this.title);
	},

	_settitle: function(str) {
		this.title = trimwhitespace(str);
		this.store();
	},

	setproject: function(pid) {
		this.project = pid;
		this.store();
	},
	
	setaccordionopened: function(b) {
		this.accordionopened = b;
		this.store();
	},
	
	addnode: function(id, asproxy) {
		if (asproxy==null)  asproxy=false;
		if (this.nodes.indexOf(id)!=-1) {
			bugreport('node already belongs to component','Component.addnode');
		}
		var nd = Node.get(id);
		if (!nd) {
			bugreport('no such node','Component.addnode');
		}
		nd.setcomponent(this.id);
		if (this.single && asproxy) {
			this.nodes.unshift(id);
		} else {
			this.nodes.push(id);
		}
		// Since the list of vulns on 'nd' may be different from those of 'this' component,
		// remove 'nd' from all node clusters, and re-add it to the ones it should belong to,
		// based on the new nd.component. Unless the component is singular.
		nd.removefromnodeclusters();
		if (!this.single || asproxy) {
			// If this is a 'single' node cluster, then only this.nodes[0] must be
			// present in the clusters.
			nd.addtonodeclusters();
		}
		if (this.single && asproxy) {
			// remove the previous representative
			let n = Node.get(this.nodes[1]);
			n.removefromnodeclusters();
		}
		this.store();
		if (this.id==Component.ThreatsComponent) {
			$('#componentthreats').dialog('option', 'title',
				_("Vulnerability assessment for '%%'", H(this.title)) +
				(this.nodes.length>1 ? _(" (%% nodes)",this.nodes.length) : "")
			);
		}
	},
	
	removenode: function(id) {
		if (this.nodes.indexOf(id)==-1) {
			bugreport('node does not belong to component','Component.removenode');
		}
		// When this component is 'single', only nodes[0] will be present in the NodeClusters.
		// If nodes[0] is removed, another node must be inserted as placeholder for the Component
		// in the node clusters.
		var i = this.nodes.indexOf(id);
		this.nodes.splice(i,1);
		var wassingle = this.single;
		if (this.nodes.length<2) {
			this.single = false;
		}
		if (i==0 && wassingle) {
			// Removing the one node that was present in the node clusters
			//var rn = Node.get(id);
			//rn.removefromnodeclusters();
			// Add a new placeholder into the clusters
			var rn = Node.get(this.nodes[0]);
			rn.addtonodeclusters();
		}
		if (this.nodes.length==0) {
			this.destroy();
		} else {
			this.store();
			if (this.id==Component.ThreatsComponent) {
				$('#componentthreats').dialog('option', 'title',
					_("Vulnerability assessment for '%%'", H(this.title)) +
					(this.nodes.length>1 ? _(" (%% nodes)",this.nodes.length) : "")
				);
			}
		}
	},
	
	addthrass: function(te,idx) {
//		this.thrass.push(te.id);
		if (idx==null)  idx = this.thrass.length;
		this.thrass.splice(idx,0,te.id);
		te.setcomponent(this.id);
		for (var i=0; i<(this.single?1:this.nodes.length); i++) {
			NodeCluster.addnode_threat(this.project,this.nodes[i],te.title,te.type,false);
		}
		this.calculatemagnitude();
		this.store();
	},
	
	removethrass: function(te) {
		this.thrass.splice( this.thrass.indexOf(te), 1 );
		this.calculatemagnitude();
		ThreatAssessment.get(te).destroy();
		this.store();
	},
	
	threatdata: function() {
		let ths = [];
		for (const tid of this.thrass) ths.push(ThreatAssessment.get(tid).toobject);
		return ths;
	},

	threatsnotevaluated: function() {
		var mustdoevals=0;
		for (const thid of this.thrass) {
			if (ThreatAssessment.get(thid).freq=='-' ||
				ThreatAssessment.get(thid).impact=='-') {
				mustdoevals++;
			}
		}
		return mustdoevals;
	},

//	adddefaultthreatevaluations: function(id) {
//		if (id!=null) {
//			// Copy threat evaluations from Component id
//			var te;
//			var cm = Component.get(id);
//			for (var i=0; i<cm.thrass.length; i++) {
//				var oldte = ThreatAssessment.get(cm.thrass[i]);
//				te = new ThreatAssessment(oldte.type);
//				te.setcomponent(this.id);
//				te.settitle(oldte.title);
//				te.setdescription(oldte.description);
//				te.setfreq(oldte.freq);
//				te.setimpact(oldte.impact);
//				te.setremark(oldte.remark);
//				te.computetotal();
//				this.thrass.push(te.id);
//			}
//		} else {
//			// Copy default threats, preserving the order in which they appear in the project.
//			var p = Project.get(Project.cid);
//			for (i=0; i<p.threats.length; i++) {
//				var th = Threat.get(p.threats[i]);
//				if (th.type!=this.type && this.type!='tUNK') continue;
//				// ThreatAssessments on a node/component of type tUNK will have the type of
//				// the Threat, not tUNK. So a tUNK component will have TAs with a type that
//				// differs from the node/component itself.
//				te = new ThreatAssessment(th.type);
//				te.setcomponent(this.id);
//				te.settitle(th.title);
//				te.setdescription(th.description);
//				this.thrass.push(te.id);
//			}
//		}
//		this.store();
//	},

	calculatemagnitude: function() {
		if (this.thrass.length==0) {
			// Must be the same as default for new nodes, which also have no thrass[].
			this.magnitude='-';
			return;
		}
		this.magnitude = ThreatAssessment.get(this.thrass[0]).total;
		for (const thid of this.thrass) {
			this.magnitude = ThreatAssessment.sum(
				this.magnitude,
				ThreatAssessment.get(thid).total
			);
		}
		for (const nid of this.nodes) Node.get(nid).setmarker();
	},
	
	setsingle: function(single) {
		var i, rn;
		if (this.single && !single) {
			// Change from single to multiple
			// Add all but the first node to all node clusters
			for (i=1; i<this.nodes.length; i++) {
				rn = Node.get(this.nodes[i]);
				rn.addtonodeclusters();
			}
		} else if (!this.single && single) {
			// Change from multiple to single
			// Remove all but the first node from all node clusters
			for (i=1; i<this.nodes.length; i++) {
				rn = Node.get(this.nodes[i]);
				rn.removefromnodeclusters();
			}
		} else {
			// No change
			return;
		}
		this.single = single;
		this.repaintmembertitles();
		this.store();
	},
	
	setmarkeroid: function(oid) {
		this._markeroid = oid;
		this.setmarker();
	},
	
	setmarker: function() {
		if (this._markeroid==null)  return;
		var str = '<span class="Magnitude M'
				+ThreatAssessment.valueindex[this.magnitude]
				+'" title="'+ThreatAssessment.descr[ThreatAssessment.valueindex[this.magnitude]]+'">'+this.magnitude+'</span>';
		if (this.threatsnotevaluated()!=0) {
			str = '<span class="incomplete">' + _("Incomplete") + '</span>' + str;
		}
		$(this._markeroid).html(str);
	},

	repaint: function() {
		// repaint this component for each service in which it occurs
		let svcs = [];
		for (const nid of this.nodes) {
			const nd = Node.get(nid);
			if (svcs.indexOf(nd.service)!=-1) continue;
			svcs.push(nd.service);
		}
		for (const sid of svcs) {
			let snippet = "";
			for (const thid of this.thrass) snippet += ThreatAssessment.get(thid).addtablerow_textonly("sfa"+sid+'_'+this.id) + '\n';
			$('#sfaccordion'+sid+'_'+this.id+' .sfa_sortable').html(snippet);
			for (const thid of this.thrass) ThreatAssessment.get(thid).addtablerow_behavioronly('#sfa'+sid+'_'+this.id,"sfa"+sid+'_'+this.id);
			this.setmarkeroid("#sfamark"+sid+'_'+this.id);
		}
		if (this.id==Component.ThreatsComponent) {
			refreshComponentThreatAssessmentsDialog();
		}
	},

	_stringify: function() {
		var data = {};
		// When comparing projects (e.g. for debugging) it is useful if the order of
		// items in the project file is the same, but only if the order is not relevant.
		// Therefore sort nodes (but not thrass)
		// For singular classes nodes[0] must remain fixed!
		if (this.single) {
			let sub = this.nodes.slice(1);
			sub.sort();
			sub.unshift(this.nodes[0]);
			this.nodes = sub;
		} else {
			this.nodes.sort();
		}
		data.t=this.type;
		data.p=this.project;
		data.l=this.title;
		data.e=this.thrass;
		data.n=this.nodes;
		data.s=this.single;
		data.o=(this.accordionopened==true);
		return JSON.stringify(data);
	},
	exportstring: function() {
		var key = LS+'C:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},

	store: function() {
		var key = LS+'C:'+this.id;
		localStorage[key] = this._stringify();
	},
	
	internalCheck: function() {
		var errors = "";
		var offender = "Component '"+H(this.title)+"' ("+this.id+") ";
		var i,j;
		let key = LS+'C:'+this.id;
		let lsval = localStorage[key];

		if (!lsval) {
			errors += offender+" is not in local storage.\n";
		}
		if (lsval && lsval!=this._stringify()) {
			errors += offender+" local storage is not up to date.\n";
			console.log('local storage: ' + lsval);
			console.log('current state: ' + this._stringify());
		}
		for (i=0; i<this.nodes.length; i++) {
			var rn = Node.get(this.nodes[i]);
			if (!rn) {
				errors += offender+"contains an nonexisting node "+this.nodes[i]+".\n";
				continue;
			}
			if (rn.component!=this.id) {
				errors += offender+"has a member node "+rn.id+" that doesn't refer back.\n";
				continue;
			}
			if (!isSameString(rn.title,this.title)) {
				errors += offender+"has a member node "+rn.id+" that has a different title.\n";
				continue;
			}
			for (j=0; j<i; j++) {
				if (this.nodes[i]==this.nodes[j]) {
					errors += offender+"contains duplicate node "+this.nodes[i]+".\n";
				}
			}
		}
		var sfx = [];
		for (const nid of this.nodes) sfx.push(Node.get(nid).suffix);
		for (i=0; !this.single && i<this.nodes.length; i++) {
			if (sfx[i]=="") continue;
			rn = Node.get(this.nodes[i]);
			j = sfx.indexOf(rn.suffix);
			if (i!=j) {
				errors += offender+"contains an duplicate suffix '"+sfx[i]+"'.\n";
				continue;
			}
		}
		for (i=0; i<this.thrass.length; i++) {
			for (j=0; j<i; j++) {
				if (this.thrass[i]==this.thrass[j]) {
					errors += offender+"contains duplicate vuln assessment "+this.thrass[i]+".\n";
				}
			}
			var ta = ThreatAssessment.get(this.thrass[i]);
			if (!ta) {
				errors += offender+"contains an nonexisting vuln assessment "+this.thrass[i]+".\n";
				continue;
			}
			if (ta.component!=this.id) {
				errors += offender+"has a member vuln assessment "+ta.id+" that doesn't refer back.\n";
				continue;
			}
			if (ta.cluster) {
				errors += offender+"has a member vuln assessment "+ta.id+" that also refers to a node cluster.\n";
				continue;
			}
			if (ta.type!=this.type && this.type!='tUNK') {
				errors += offender+"has a member vuln assessment "+ta.id+" with a non-matching type.\n";
				continue;
			}
			// Each node in this component should belong to a cluster whose rootcluster has the same 
			// type and title as this ThreatAssessment
			var it = new NodeClusterIterator({project: this.project, type: ta.type, title: ta.title});
			if (it.count()==0) {
				errors += offender+"has a vuln assessment "+ta.id+" that does not have a corresponding node cluster.\n";
				continue;
			}
			if (it.item.length>1) {
				errors += offender+"has a vuln assessment "+ta.id+" that has more than one corresponding node cluster.\n";
				continue;
			}
			var cc = it.first();
			cc = NodeCluster.get(cc.root());
			for (j=0; j<(this.single? 1 : this.nodes.length); j++) {
				if (!cc.containsnode(this.nodes[j])) {
					errors += offender+"has a node "+this.nodes[j]+" that does not appear in the node cluster for "+H(ta.title)+" ("+H(ta.type)+").\n";
				}
			}
		}
		// Check all nodes that claim to belong to this component
		it = new NodeIterator();
		for (const rn of it) {
			if (rn.component!=this.id) continue;
			if (this.nodes.indexOf(rn.id)==-1) {
				errors += "Node "+rn.id+" claims to belong to component "+this.id+" but doesn't appear in the list.\n";
			}
		}
		// Duplicate component titles
		for (i in Component._all) {
			let cm = Component._all[i];
			if (isSameString(cm.title,this.title)
				&& cm.id>this.id // when all components are checked, only show this error once
				&& cm.type==this.type
				&& cm.project==this.project
			) {
				errors += offender+"has the same title as component "+cm.id+".\n";
			}
		}
		return errors;
	}
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * ComponentIterator: iterate over all components of a project
 *
 * opt: object with options to restrict the iteration to specified items only.
 *		Specify project (ID), service (ID), type (string), and/or match (string).
 * Option 'match' is similar to 'type'; 'type' looks for equality, but 'match'
 * looks for either equality or a cloud-type.
 *
 * usage:
 * 		var it = new ComponentIterator({project: ppppp, service: sssss, type: ttttt});
 * 		for (const cm of it) {
 *			console.log(cm.title);
 *			console.log(cm.id);
 *	 		:
 *		}
 */
class ComponentIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		this.item = [];
		for (var i in Component._all) {
			var cm =  Component._all[i];
			// The component is part of a project if one of its nodes belongs to a
			// service that belongs to that project.
			var ok = true, j, occurs;
			if (opt.project!=null) {
				ok = ok && (cm.project==opt.project);
			}
			if (ok && opt.type!=null) {
				ok = ok && (cm.type==opt.type);
			}
			if (ok && opt.match!=null) {
				ok = ok && (cm.type==opt.match
					|| cm.type=='tUNK'
					|| opt.match=='tUNK'
				);
			}
			if (ok && opt.service!=null) {
				occurs=false;
				for (j=0; !occurs && j<cm.nodes.length; j++) {
					occurs = (Node.get(cm.nodes[j]).service==opt.service);
				}
				ok = ok && occurs;
			}
			if (ok) this.item.push(cm);
		}
	}

	*[Symbol.iterator]() {
		for (const id of this.item) {
			yield id;
		}
	}

	count() {
		return this.item.length;
	}
	
	sortByName() {
		this.item.sort( function(ca,cb) {
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	}
	
	sortByType() {
		this.item.sort( function(ca,cb) {
			if (ca.type<cb.type)  return -1;
			if (ca.type>cb.type)  return 1;
			// When types are equal, sort alphabetically
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	}
	
	sortByLevel() {
		this.item.sort( function(ca,cb) {
			var va = ThreatAssessment.valueindex[ca.magnitude];
			var vb = ThreatAssessment.valueindex[cb.magnitude];
			if (va==1) va=8; // Ambiguous
			if (vb==1) vb=8;
			if (va!=vb) {
				return vb - va;
			}
			// When levels are equal, sort alphabetically
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	}	
}
