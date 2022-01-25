/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* global bugreport, _, repaintCluster, Component, createUUID, DEBUG, LS, Assessment, NodeClusterIterator, Vulnerability, VulnerabilityIterator, H, createUUID, isSameString, reasonableString
 */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * NodeCluster: a group of nodes that share a threat, and form a threat-domain.
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all: Map of all Node elements, indexed by id
 *	get(i): returns the object with id 'i'.
 *	addnode_threat(p,nid,ti,ty,dupl): update clusters when node with id 'nid' has a threat named 'ti'
 *		of type 'ty'. Raise an error if dupl==false and the combination was already added.
 *	addcomponent_threat(p,cid,ti,ty,dupl): update clusters when component with id 'cid' has a threat
 *		named 'ti' of type 'ty'.
 *	removecomponent_assessment: reverse of addcomponent_threat().
 *  structuredata(pid): object describing the structure of all clusters in a project, for undoing node deletion
 *	titleisused(str): returns true iff there is a cluster with title 'str'
 *	autotitle(str): get a unique cluster name based on 'str'
 * Instance properties:
 *	id: UUID
 *  type:
 *	project: project to which this NodeCluster belongs.
 *	title:
 *	assmnt: a Assessment id, holding the cluster's estimate
 *	parentcluster: NodeCluster to which this cluseter belongs, or null for the root
 *	childclusters[]: Child clusters of this cluster.
 *	childnodes[]: Nodes that share this threat.
 *	magnitude:
 *	_markeroid: (getter) DOM id of the vulnerability marker of this cluster
 *	accordionopened: whether the NodeCluster accordion needs to be opened in Common Cause Failure view.
 * Methods:
 *	destroy(): destructor.
 *	setproject(pid): set the project to which this NodeCluster belongs to pid.
 *	setparent(nc): set the parent of this cluster to nc.
 *	settitle(str): sets the title (and the title of the thrass) to 't'.
 *	addassessment(id): adds a new, blank threat assessment to this cluster; the id of the new threat assessment is optional.
 *	addchildcluster(id): add a child cluster 'id' to this cluster.
 *	removechildcluster(id): remove child cluster 'id' from this cluster.
 *	addchildnode(nid): add a child node 'nid' to this cluster.
 *	removechildnode(nid): remove node 'nid' from this tree, and/or from any of its subtrees
 *	containsnode(nid): checks whether node 'nid' is contained in this cluster, or any subcluster.
 *	containscluster(ncid): checks whether cluster 'ncid' is contained in this cluster, or any subcluster.
 *	root(): returns the ultimate root-cluster of this cluster.
 *  depth(): 0 for root, one more for each step removed from root in parent-child relations.
 *	isroot(): true iff this cluster has no parent.
 *  isempty(): true iff this cluster has no parent, child clusters, nor child nodes.
 *	allnodes(): returns a flat array of all nodes in this tree.
 *	allclusters(): returns a flat aray of all clusters in this tree (including this cluster itself).
 *	normalize(): flattens child clusters with zero or one childclusters/nodes.
 *	calculatemagnitude(): compute this.magnitude and update DOM.
 *	setmarker: set HTML of _markeroid based on this.magnitude.
 *  structure(): return an object describing this nodecluster
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
*/
var NodeCluster = function(type, id) {
	if (!id) {
		console.warn("*** No id specified for new NodeCluster");
	}
	if (id!=null && NodeCluster._all.has(id)) {
		bugreport("NodeCluster with id "+id+" already exists","NodeCluster.constructor");
	}
	if (type=='tACT' || type=='tUNK' || type=='tNOT') {
		bugreport("NodeCluster with id "+id+" has illegal type "+type,"NodeCluster.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.type = type;
	this.title = NodeCluster.autotitle();
	this.project = null;
	this.parentcluster = null;
	this.childclusters = [];
	this.childnodes = [];
	this.assmnt = null;
	this.magnitude = '-';
	this.accordionopened = true;

	this.store();
	NodeCluster._all.set(this.id,this);
};
NodeCluster._all = new Map();
NodeCluster.get = function(id) { return NodeCluster._all.get(id); };

NodeCluster.titleisused = function(str) {
	let it = new NodeClusterIterator({title: str});
	return (!it.isEmpty());
};
NodeCluster.autotitle = function(str) {
	if (!str)  str = _("New cluster");
	let targettitle = str;
	if (NodeCluster.titleisused(targettitle)) {
		var n=0;
		do {
			targettitle = str + " (" + (++n) + ")";
		} while (NodeCluster.titleisused(targettitle));
	}
	return targettitle;
};
NodeCluster.addnode_threat = function(pid,nid,threattitle,threattype,duplicateok) {
	// Locate the corresponding cluster in the project. 
	// There should be exactly one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.count()>1) {
		bugreport("Multiple matches","NodeCluster.addnode_threat");
		return;
	} else if (it.isEmpty()) {
		bugreport("No rootcluster found","NodeCluster.addnode_threat");
		return;
	}
	var nc = it.first();
//console.debug("Adding node "+nid+" to cluster "+nc.id+" ["+threattitle+"|"+threattype+":"+nc.project+"]");
	if (nc.containsnode(nid)) {
		if (duplicateok!=true) {
			bugreport("Duplicate node in cluster","NodeCluster.addnode_threat");
		}
		return;
	}
	nc.addchildnode(nid);
	repaintCluster(nc.id);
};
NodeCluster.addcomponent_threat = function(pid,cid,threattitle,threattype,duplicateok) {
	var cm = Component.get(cid);
	if (!cm) {
		bugreport("No such component","NodeCluster.addcomponent_threat");
	}
	// Locate the corresponding cluster in the project. 
	// There should be exactly one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.count()>1) {
		bugreport("Multiple matching clusters","NodeCluster.addcomponent_threat");
		return;
	} else if (it.isEmpty()) {
		bugreport("No rootcluster found","NodeCluster.addnode_threat");
		return;
	}
	var nc = it.first();
	for (var i=0; i<(cm.single?1:cm.nodes.length); i++) {
		if (nc.containsnode(cm.nodes[i])) {
			if (duplicateok) continue;
			bugreport("Duplicate node in cluster","NodeCluster.addcomponent_threat");
		}
		nc.addchildnode(cm.nodes[i]);
	}
	repaintCluster(nc.id);
};
NodeCluster.removecomponent_assessment = function(pid,cid,threattitle,threattype,notexistok) {
	// Locate the corresponding cluster in the project. 
	// There should be at most one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.count()>1) {
		bugreport("Multiple matching clusters","NodeCluster.removecomponent_assessment");
	} else if (it.isEmpty()) {
		if (!notexistok) {
			bugreport("No matching cluster","NodeCluster.removecomponent_assessment");
		}
		return null;
	}
	var nc = it.first();
	var cm = Component.get(cid);
	if (!cm) {
		bugreport("No such component","NodeCluster.removecomponent_assessment");
	}
	// If the node cluster is 'singular' then remove only the first node.
	for (var i=0; i< (cm.single?1:cm.nodes.length); i++) {
		if (!nc.containsnode(cm.nodes[i])) {
			if (notexistok) continue;
			bugreport("No such node in cluster","NodeCluster.removecomponent_assessment");
		}
		nc.removechildnode(cm.nodes[i]);
	}
	nc.normalize();
	// Test whether this node cluster has an associated Vulnerability
	let hasthreat = false;
	it = new VulnerabilityIterator({project: nc.project, type: nc.type});
	for (const th of it) {
		if (th.title!=nc.title)  continue;
		hasthreat = true;
		break;
	}
	if (nc.childclusters.length==0 && nc.childnodes.length==0 && nc.parentcluster==null && !hasthreat) {
		nc.destroy();
	} else {
		repaintCluster(nc.id);
	}
	return nc;
};

NodeCluster.structuredata = function(pid) {
	let res = [];
	let it = new NodeClusterIterator({project: pid, isroot: true});
	it.forEach(nc => res.push(nc.structure()));
	return res;
};

NodeCluster.prototype = {
	get _markeroid() {
		return '#ccfamark'+this.id;
	},

	destroy: function() {
		localStorage.removeItem(LS+'L:'+this.id);
		Assessment.get(this.assmnt).destroy();
		NodeCluster._all.delete(this.id);
	},

	setproject: function(p) {
		this.project = p;
		this.store();
	},

	setparent: function(p) {
		this.parentcluster = p;
		this.store();
	},

	settitle: function(str) {
		str = reasonableString(str);
		if (this.title==str)  return;
		var it = new NodeClusterIterator({project: this.project, isroot: true, type: this.type, title: str});
		if (it.count()>0) {
			bugreport("Already exists","NodeCluster.settitle");
		}
		if (!this.isroot() && this.assmnt!=null) {
			var ta = Assessment.get(this.assmnt);
			ta.settitle(str);
			this.title=ta.title;
		} else {
			this.title=str;
		}
		this.store();
	},
	
	addchildcluster: function(childid,force) {
		if (force==null)  force==true;
		NodeCluster.get(childid).setparent(this.id);
		if (DEBUG && this.childclusters.indexOf(childid)!=-1) {
			if (!force)  return;
			bugreport("NodeCluster already contains that child cluster","NodeCluster.addchildcluster");
		}
		this.childclusters.push(childid);
		this.store();
	},
	
	removechildcluster: function(childid) {
		var pos = this.childclusters.indexOf(childid);
		if (DEBUG && pos==-1) {
			bugreport("NodeCluster does not contain that child cluster","NodeCluster.removechildcluster");
		}
		this.childclusters.splice(pos,1);
		this.store();
	},
	
	addchildnode: function(childid,force) {
		if (force==null)  force==true;
		if (DEBUG && this.childnodes.indexOf(childid)!=-1) {
			bugreport("NodeCluster already contains that child node","NodeCluster.addchildnode");
			if (!force)  return;
		}
		this.childnodes.push(childid);
		this.store();
	},
	
	removechildnode: function(childid) {
		var pos = this.childnodes.indexOf(childid);
		if (pos!=-1) {
			this.childnodes.splice(pos,1);
			this.store();
		} else {
			for (const clid of this.childclusters) NodeCluster.get(clid).removechildnode(childid);
		}
	},

	containsnode: function(target) {
		if (this.childnodes.indexOf(target)!=-1)  return true;
		for (let child of this.childclusters) {
			if (NodeCluster.get(child).containsnode(target))  return true;
		}
		return false;
	},
	
	containscluster: function(target) {
		if (this.childclusters.indexOf(target)!=-1)  return true;
		for (let child of this.childclusters) {
			if (NodeCluster.get(child).containscluster(target))  return true;
		}
		return false;
	},
	
	allnodes: function() {
		var arr = [].concat(this.childnodes);
		for (const clid of this.childclusters) arr = arr.concat(NodeCluster.get(clid).allnodes());
		return arr;
	},
	
	allclusters: function() {
		var arr = [this.id];
		for (const clid of this.childclusters) arr = arr.concat(NodeCluster.get(clid).allclusters());
		return arr;
	},
	
	addassessment: function(newid) {
		if (!newid) newid = createUUID();
		var ta = Assessment.get(newid);
		if (ta==null)  ta = new Assessment(this.type, newid);
		this.assmnt = ta.id;
		ta.setcluster(this.id);
		// For root clusters, the Assessment gets its title from the common Vulnerability
		if (!this.isroot())  ta.settitle(this.title);
		this.store();
	},
	
	isroot: function() {
		return (this.parentcluster==null);
	},
	
	isempty: function() {
		return (this.parentcluster==null && this.childclusters.length==0 && this.childnodes.length==0);
	},
	
	root: function() {
		return (this.parentcluster==null ? this.id : NodeCluster.get(this.parentcluster).root() );
	},

	depth: function() {
		return (this.parentcluster==null ? 0 : NodeCluster.get(this.parentcluster).depth()+1 );
	},

	normalize: function() {
		for (const clid of this.childclusters) {
			var cc = NodeCluster.get(clid);
			cc.normalize();
			if (cc.childclusters.length + cc.childnodes.length < 2) {
				// Assimilate the child cluster.
				if (cc.childclusters[0]) {
					var grandchild = NodeCluster.get(cc.childclusters[0]);
					this.childclusters.push(cc.childclusters[0]);
					grandchild.parentcluster = this.id;
					grandchild.store();
				}
				if (cc.childnodes[0]) {
					this.childnodes.push(cc.childnodes[0]);
				}
				this.removechildcluster(cc.id);	// Includes this.store()
				cc.destroy();
			}
		}
		if (this.childclusters.length==1 && this.childnodes.length==0) {
			// Assimilate the child cluster.
			cc = NodeCluster.get(this.childclusters[0]);
			this.childclusters = [];
			for (const clid of cc.childclusters) {
				grandchild = NodeCluster.get(clid);
				grandchild.parentcluster = this.id;
				grandchild.store();
				this.childclusters.push(clid);
			}
			this.childnodes = cc.childnodes;
			cc.destroy();
			this.store();
		}
	},
	
	calculatemagnitude: function() {
		if (this.assmnt==null) {
			this.magnitude='-';
			return;
		}
		this.magnitude = Assessment.get(this.assmnt).total;
		for (const clid of this.childclusters) {
			var cc = NodeCluster.get(clid);
			cc.calculatemagnitude();
			this.magnitude = Assessment.sum(this.magnitude,cc.magnitude);
		}
		this.setmarker();
	},
	
	isincomplete: function() {
		var ta = Assessment.get(this.assmnt);
//		if ((ta.freq=="-" || ta.impact=="-") && this.childnodes.length>1)
		if (ta.freq=="-" || ta.impact=="-") {
			return true;
		}
		for (const clid of this.childclusters) {
			var cc = NodeCluster.get(clid);
			if (cc.isincomplete())  return true;
		}
		return false;
	},
	
	setmarker: function() {
		var str = '<span class="Magnitude M'
				+Assessment.valueindex[this.magnitude]
				+'" title="'+Assessment.descr[Assessment.valueindex[this.magnitude]]+'">'+this.magnitude+'</span>';
		if (this.isroot() && this.isincomplete()) {
			str = '<span class="incomplete">' + _("Incomplete") + '</span>' + str;
		}
		$(this._markeroid).html(str);
	},
		
	setaccordionopened: function(b) {
		this.accordionopened = b;
		this.store();
	},
	
	structure: function() {
		let ta = Assessment.get(this.assmnt);
		let c = {};
		// id: ID of the cluster object
		// type: type of the cluster
		// project: project to which this cluster belongs
		// parent: ID of the parent cluster (null, if root cluster)
		// title: title of the cluster
		// accordionopened: cluster is folded open in CCF view
		// thrass: object containing info on the cluster's vulnerability assessment
		//   id, type, title, description, freq, impact, remark: as of the threat assessment
		// childnode: array of IDs of all child nodes of this cluster
		// childcluster: object containing the same properties (except childnode/childcluster)
		c.id = this.id;
		c.type = this.type;
		c.project = this.project;
		c.parent = this.parentcluster;
		c.title = this.title;
		c.accordionopened = this.accordionopened;
		c.assmnt = {
			id: ta.id,
			type: ta.type,
			title: ta.title,
			description: ta.description,
			freq: ta.freq,
			impact: ta.impact,
			remark: ta.remark
		};
		c.childnode = this.childnodes.slice();
		c.childcluster = [];
		for (const cc of this.childclusters) c.childcluster.push(NodeCluster.get(cc).structure());
		return c;
	},

	_stringify: function() {
		var data = {};
		// When comparing projects (e.g. for debugging) it is useful if the order of
		// items in the project file is the same.
		// Therefore sort childclusters and childnodes
		this.childclusters.sort();
		this.childnodes.sort();
		data.t=this.type;
		data.l=this.title;
		data.p=this.project;
		data.u=this.parentcluster;
		data.c=this.childclusters;
		data.n=this.childnodes;
		data.e=this.assmnt;
		data.o=this.accordionopened;
		return JSON.stringify(data);
	},
	
	exportstring: function() {
		var key = LS+'L:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},

	store: function() {
		var key = LS+'L:'+this.id;
		localStorage[key] = this._stringify();
	},
	
	internalCheck: function() {
		var errors = "";
		var offender = "Node cluster '"+H(this.title)+"' ("+this.id+") ";
		var i, j;
		let key = LS+'L:'+this.id;
		let lsval = localStorage[key];

		if (!lsval) {
			errors += offender+" is not in local storage.\n";
		}
		if (lsval && lsval!=this._stringify()) {
			errors += offender+" local storage is not up to date.\n";
		}
		for (i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			if (!cc) {
				errors += offender+" contains a non-existing child cluster "+this.childclusters[i]+".\n";
				continue;
			}
			if (cc.project != this.project) {
				errors += offender+" contains a child cluster "+this.childclusters[i]+" that belongs to a different project.\n";
			}
			if (cc.parentcluster != this.id) {
				errors += offender+" contains a child cluster "+this.childclusters[i]+" that does not refer back to it.\n";
			}
			errors += cc.internalCheck();
			for (j=0; j<i; j++) {
				if (this.childclusters[i]==this.childclusters[j]) {
					errors += offender+" contains duplicate child cluster "+this.childclusters[i]+".\n";
				}
			}
		}

		var rc = NodeCluster.get(this.root());
		if (!rc) {
			errors += offender+" does not have proper root.\n";
		}
		var ta = Assessment.get(this.assmnt);
		if (!ta) {
			errors += offender+" contains an nonexisting assessment "+this.assmnt+".\n";
		} else {
			if (ta.cluster!=this.id)	errors += offender+" has a member assessment "+ta.id+" that doesn't refer back.\n";
			if (ta.component)			errors += offender+" has a member assessment "+ta.id+" that also refers to a component.\n";
			if (ta.type!=this.type)		errors += offender+" has a member assessment "+ta.id+" with a non-matching type.\n";
			if (!isSameString(ta.title,this.title))	errors += offender+"has a member assessment "+ta.id+" with a different title.\n";
		}
		if (this.isroot()) {
			let vid = ta.vulnerability;
			if (vid==null) {
				errors += offender+" has an assessment that lacks a corresponding vulnerability.\n";
			} else {
				let v = Vulnerability.get(vid);
				if (v==null) {
					errors += offender+" has an assessment with a non-existing vulnerability.\n";
				} else {
					if (!isSameString(v.title,this.title)) errors += offender+" has an assessment with a vulnerability that has a different title.\n";
				}
			}
		}

		for (i=0; i<this.childnodes.length; i++) {
			var rn = Node.get(this.childnodes[i]);
			if (!rn) {
				errors += offender+" contains a non-existing child node "+this.childnodes[i]+".\n";
				continue;
			}
			if (rn.project!=this.project) {
				errors += offender+" contains child node belonging to another project "+this.childnodes[i]+".\n";
				continue;
			}
			for (j=0; j<i; j++) {
				if (this.childnodes[i]==this.childnodes[j]) {
					errors += offender+" contains duplicate child node "+this.childnodes[i]+".\n";
				}
			}
			var cm = Component.get(rn.component);
			if (!cm) {
				errors += offender+" has a child node "+rn.id+" that does not have a valid component.\n";
				continue;
			}
			// The component of each child node must have a threat assessment that matches this cluster
			for (j=0; j<cm.assmnt.length; j++) {
				ta = Assessment.get(cm.assmnt[j]);
				if (ta && isSameString(ta.title,rc.title) && ta.type==rc.type) {
					break;
				}
			}
			if (j==cm.assmnt.length) {
				errors += offender+" has a child node "+rn.id+" that does not have vulnerability of this kind.\n";
				continue;
			}
		}
		return errors;
	}
};

