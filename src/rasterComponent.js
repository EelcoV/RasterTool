/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals bugreport, createUUID, prependIfMissing, Rules, _, isSameString, LS, Assessment, Transaction, NodeCluster, NodeClusterIterator, VulnerabilityIterator, refreshComponentThreatAssessmentsDialog, H, Project */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Component: a physical component, or class of identical components
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all: Map of all Node elements, indexed by id
 *	ThreatsComponent: if of the node for which the threats dialog is visible.
 *	get(i): returns the object with id 'i'.
 *	hasTitleTypeProject(str,type,pid): returns the id of the Component object with title 'str',
 *		type 'type' and project 'pid', or -1 if no such Component exists.
 * Instance properties:
 *	type: one of 'tWLS','tWRD','tEQT','tUNK'
 *	id: UUID
 *	title: retrieve current title
 *	project: project to which this component belongs
 *	assmnt[]: array of Assessment id's, holding the threat estimates
 *	nodes[]: array of Node objects that share this component.
 *	magnitude: overall vulnerability of this component
 *	single: true iff the component has a single physical existence (i.s.o. multiple identical copies)
 *	_markeroid: id of DOM object in which evaluation status is shown.
 *	accordionopened: whether the Component accordion needs to be opened in Single Failure view.
 * Methods:
 *	destroy(): destructor.
 *	absorbe(c): merge data from another component into this, then destroy() that other component
 *	mergeclipboard: create Transactions to paste Assessment.Clipboard into this.
 *  repaintmembertitles: ensure all members have unique suffixes, then repaint all members
 *	setclasstitle(str): set title of component and all members to 'str', and update DOM.
 *	changeclasstitle(str): if permitted, sets the header text to 'str'.
 *	setproject(pid): sets the project to pid (numerical).
 *	addnode(n.id, asproxy): add a node to this component. asproxy: if the component is singular
 *		then add this node as it representative in the node clusters.
 *	removenode(n.id): remove the node from this component
 *	addassessment(ta,idx): add the Assessment object at index idx.
 *	removeassessment(te): remove the Assessment object.
 *  assessmentdata(): returns do/undo data for Assessments in assmnt[].
 *	threatsnotevaluated: returns the number of Assessments that have not been fully evaluated.
 *	adddefaultassessments(): copy assessments from another component or checklists.
 *	calculatemagnitude: calculate the overall vulnerability of this component.
 *	setsingle(b): change singular/multiple flag (this.single) to 'b'.
 *	setmarkeroid(oid): change _markeroid and set status.
 *	setmarker: show/hide/set the status marker.
 *  repaint: refresh the UI on the SF tab and the vulnerabilities dialogue
 *	updateLabelGroup(sid): repaint the labels on the indicated SF tab
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
	if (id!=null && Component._all.has(id)) {
		bugreport("Component with id "+id+" already exists","Component.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.type = type;
	this.project = pid;
	this.nodes = [];
	this.title = _("Component ") + Rules.nodetypes[this.type] + " " + this.id;
	this.assmnt = [];
	this.magnitude = 'U';
	this.single = false;
	this._markeroid = null;
	this.accordionopened = false;

	this.store();
	Component._all.set(this.id,this);
};
Component._all = new Map();
Component.ThreatsComponent = -1;
Component.get = function(id) { return Component._all.get(id); };
Component.hasTitleTypeProject = function(str,typ,pid) {
	for (var idobj of Component._all) {
		if (isSameString(idobj[1].title,str)
			&& idobj[1].type==typ
			&& idobj[1].project==pid)  return idobj[0];
	}
	return -1;
};
Component.prototype = {
	destroy: function() {
		localStorage.removeItem(LS+'C:'+this.id);
		if (this.id==Component.ThreatsComponent) {
			$('#componentthreats').dialog('close');
		}
		for (const thid of this.assmnt) Assessment.get(thid).destroy();
		Component._all.delete(this.id);
	},

	absorbe: function(cm) {
		// Merge all new threvals from cm into this. If both contain a threat with the
		// same name, then use the worst values from each
		for (const thid of cm.assmnt) {
			var ta =  Assessment.get(thid);
			for (var j=0; j<this.assmnt.length; j++) {
				var ta2 = Assessment.get(this.assmnt[j]);
				if (isSameString(ta2.title,ta.title)) break;
			}
			if (isSameString(ta.title,ta2.title)) {
				// This component has a threat ta2 with the same name as the one absorbed.
				ta2.setfreq( Assessment.worst(ta.freq,ta2.freq) );
				ta2.setimpact( Assessment.worst(ta.impact,ta2.impact) );
			} else {
console.log("Check Component.absorbe()");
				ta2 = new Assessment(ta.type);
				ta2.component = this.id;
				ta2.title = ta.title;
				ta2.description = ta.description;
				ta2.freq = Assessment.worst(ta.freq,'-');
				ta2.impact = Assessment.worst(ta.impact,'-');
				ta2.remark = ta.remark;
				ta2.computetotal();
				ta2.store();
				this.assmnt.push(ta2.id);
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

/* First, create structure necessary for the Paste transaction on the Component 'cm'.
 *	changea_do: the 'do' data for changes to existing Assessments on cm.
 *	changea_undo: the 'undo' data for changes to existing Assessments on cm.
 *	newassm_do: the 'do' data for adding new Assessments to cm.
 *	newassm_undo: the 'undo' data for adding new Assessments to cm.
 *	newvuln_do: the 'do' data for new Vulnerabilities.
 *	newvuln_undo: the 'undo' data for new Vulnerabilities.
 * The can be supplied to transactions 'assessmentDetails', 'assmCreateDelete', and 'vulnCreateDelete' respectively.
 *
 * Note that a Vulnerability may have to be created. Consider this scenario:
 *  (1) copy to clipboard
 *  (2) delete the last remaining Assessment of a custom Vulnerability
 *  (3) paste from clipboard.
 */
	mergeclipboard: function() {
		let changea_do=[], changea_undo=[], newvuln_do=[], newvuln_undo=[], newassm_do=[], newassm_undo=[];
		for (const clip of Assessment.Clipboard) {
			// clip object {t: assm.title, y: assm.type, d: assm.description, p: assm.freq, i: assm.impact, r: assm.remark}
			if (clip.y=='tUNK') {
				bugreport("Wrong type in clipboard data","Component.mergeclipboard");
			}
			// Try to find an identically named threat in our current list. If we are an
			// unknown link, then also the type must match. For types wireless/wired/eqt the
			// type will be converted to this.type anyway, so don't require the types to match.
			// Break as soon as we find a match.
			let i, assmnt;
			for (i=0; i<this.assmnt.length; i++) {
				assmnt = Assessment.get(this.assmnt[i]);
				if (isSameString(assmnt.title,clip.t) && (assmnt.type==clip.y || this.type!='tUNK')) break;
			}
			if (i==this.assmnt.length) {
				// Create a new Assessment
				// If this is an unknown link, then the type of our Vulnerabilities can (and should) be different from
				// this.type. For wireless/wired/eqt, the vulnerability type must be converted to this.type.
				let aid, vid, clid; // assesssment, vulnerability, root cluster respectively
				let newtype = (this.type=='tUNK' ? clip.y : this.type);
				// Check if the corresponding Vulnerability already exists
				let it = new VulnerabilityIterator({project: this.project, title: clip.t, type: newtype});
				if (it.isEmpty()) {
					vid = createUUID();
					clid = createUUID();
					newvuln_do.push({create: true, id: vid, project: this.project, type: newtype, title: clip.t, description: clip.d, common: false, cluster: clid, cla: createUUID()});
					newvuln_undo.push({create: false, id: vid});
				} else {
					let v = it.first();
					vid = v.id;
					// Find the corresponding root cluster
					it = new NodeClusterIterator({project: this.project, title: v.title, type:v.type, isroot: true});
					clid = it.first().id;
				}
				// Create the new assessment
				aid = createUUID();
				newassm_do.push({create: true, clid: clid, vuln: vid, assmnt: [{id: aid, component: this.id, freq: clip.p,impact: clip.i, remark: clip.r}]});
				newassm_undo.push({create: false, clid: clid, assmnt: [{id: aid}]});
			} else {
				// Modify an existing assessment
				let new_f = Assessment.worst(clip.p,assmnt.freq);
				let new_i = Assessment.worst(clip.i,assmnt.impact);
				let new_r = prependIfMissing(clip.r, assmnt.remark);
				if (new_f==assmnt.freq) new_f=null;
				if (new_i==assmnt.impact) new_i=null;
				if (new_r==assmnt.remark) new_r=null;
				if (new_f!=null || new_i!=null || new_r!=null) {
					changea_do.push({assmnt: assmnt.id, component: this.id, freq: new_f, impact: new_i, remark: new_r});
					changea_undo.push({assmnt: assmnt.id, component: this.id, freq: assmnt.freq, impact: assmnt.impact, remark: assmnt.remark});
				}
			}
		}
		// Now create the Transactions
		// If changea_do and changea_undo are both empty, no 'assessmentDetails' transaction is necessary.
		// Similar for newassm_do/newassm_undo and  newvuln_do/newvuln_undo.
		// If newvuln_do is non-empty, then obviously newassm_do will be non-empty too.
		let descr = _("Paste clipboard into %%.", this.title);
		if (changea_do.length>0) {
			new Transaction('assessmentDetails', changea_undo, changea_do, descr, (newvuln_do.length>0 || newassm_do.length>0) );
		}
		if (newvuln_do.length>0) {
			new Transaction('vulnCreateDelete',  newvuln_undo, newvuln_do, descr, true);
		}
		if (newassm_do.length>0) {
			new Transaction('assmCreateDelete',  newassm_undo, newassm_do, descr, false);
		}
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
		str = str.trim();
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
		this.title = str.trim();
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
	
	addassessment: function(te,idx) {
//		this.assmnt.push(te.id);
		if (idx==null)  idx = this.assmnt.length;
		this.assmnt.splice(idx,0,te.id);
		te.setcomponent(this.id);
		for (var i=0; i<(this.single?1:this.nodes.length); i++) {
			NodeCluster.addnode_threat(this.project,this.nodes[i],te.title,te.type,false);
		}
		this.calculatemagnitude();
		this.store();
	},
	
	removeassessment: function(te) {
		this.assmnt.splice( this.assmnt.indexOf(te), 1 );
		this.calculatemagnitude();
		Assessment.get(te).destroy();
		this.store();
	},
	
	assessmentdata: function() {
		let ths = [];
		for (const tid of this.assmnt) ths.push(Assessment.get(tid).toobject);
		return ths;
	},

	threatsnotevaluated: function() {
		var mustdoevals=0;
		for (const thid of this.assmnt) {
			if (Assessment.get(thid).freq=='-' ||
				Assessment.get(thid).impact=='-') {
				mustdoevals++;
			}
		}
		return mustdoevals;
	},

	calculatemagnitude: function() {
		if (this.assmnt.length==0) {
			// Must be the same as default for new nodes, which also have no thrass[].
			this.magnitude='U';
		} else {
			this.magnitude = Assessment.get(this.assmnt[0]).total;
			for (const thid of this.assmnt) {
				this.magnitude = Assessment.sum(
					this.magnitude,
					Assessment.get(thid).total
				);
			}
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
				+Assessment.valueindex[this.magnitude]
				+'" title="'+Assessment.descr[Assessment.valueindex[this.magnitude]]+'">'+this.magnitude+'</span>';
		if (this.threatsnotevaluated()!=0) {
			str = '<span class="incomplete">' + _("Incomplete") + '</span>' + str;
		}
		$(this._markeroid).html(str);
	},

	repaint: function() {
		// repaint this component for each service in which it occurs
		let svcs = new Set();
		this.nodes.forEach(nid => svcs.add(Node.get(nid).service));
		for (const sid of svcs) {
			let prefix = `sfa${sid}_${this.id}`;
			let snippet = "";
			for (const thid of this.assmnt) snippet += Assessment.get(thid).addtablerow_textonly(prefix) + '\n';
			$('#sfaccordion'+sid+'_'+this.id+' .sfa_sortable').html(snippet);
			for (const thid of this.assmnt) Assessment.get(thid).addtablerow_behavioronly(prefix);
			this.setmarkeroid("#sfamark"+sid+'_'+this.id);
		}
		if (this.id==Component.ThreatsComponent) {
			refreshComponentThreatAssessmentsDialog();
		}
		$('.malset label').removeClass('ui-corner-left ui-corner-right');
	},

	updateLabelGroup(sid) {
		let labelset = new Set();
		for (const n of this.nodes) labelset.add(Node.get(n).color);
		let labelgroup = $(`#sfaccordion${sid}_${this.id} div.sflabelgroup`);
		labelgroup.empty();
		if (labelset.size==1) {
			let col = labelset.values().next().value;
			let idx = Project.colors.indexOf(col);
			let label = Project.get(this.project).labels[idx-1];
			labelgroup.append(`<div class="smallblock B${col}"></div><span class="labelind">${label}</span>`);
		} else if (labelset.size>1) {
			for (const col of labelset) {
				if (col=='none') continue;
				let idx = Project.colors.indexOf(col);
				let label = Project.get(this.project).labels[idx-1];
				labelgroup.append(`<div class="smallblock B${col}" title="${label}"></div>`);
			}
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
		data.e=this.assmnt;
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
			if (rn.project!=this.project) {
				errors += offender+"has a member node "+rn.id+" that belongs to a different project.\n";
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
		for (i=0; i<this.assmnt.length; i++) {
			for (j=0; j<i; j++) {
				if (this.assmnt[i]==this.assmnt[j]) {
					errors += offender+"contains duplicate vuln assessment "+this.assmnt[i]+".\n";
				}
			}
			var ta = Assessment.get(this.assmnt[i]);
			if (!ta) {
				errors += offender+"contains an nonexisting vuln assessment "+this.assmnt[i]+".\n";
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
			// type and title as this Assessment
			var it = new NodeClusterIterator({project: this.project, type: ta.type, title: ta.title});
			if (it.isEmpty()) {
				errors += offender+"has a vuln assessment "+ta.id+" that does not have a corresponding node cluster.\n";
				continue;
			}
			if (it.count()>1) {
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
		for (let idobj of Component._all) {
			let cm = idobj[1];
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

