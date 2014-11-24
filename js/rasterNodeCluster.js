/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * $Id: rasterNodeCluster.js,v 1.1.2.4.2.5.2.8 2013/07/18 19:52:23 vriezekolke Exp $
 *
 * NodeCluster: a group of nodes that share a threat, and form a threat-domain.
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all: array of all Node elements, indexed by id
 *	get(i): returns the object with id 'i'.
 *	addnode_threat(p,nid,ti,ty,dupl): update clusters when node with id 'nid' has a threat named 'ti'
 *		of type 'ty'. Raise an error if dupl==false and the combination was already added.
 *	addcomponent_threat(p,cid,ti,ty,dupl): update clusters when component with id 'cid' has a threat
 *		named 'ti' of type 'ty'.
 *	removecomponent_threat: reverse of addcomponent_threat().
 * Instance properties:
 *	id: unique number
 *  type:
 *	project: project to which this NodeCluster belongs.
 *	title:
 *	thrass: a ThrEvalation id, holding the cluster's threat estimate
 *	parentcluster: NodeCluster to which this cluseter belongs, or null for the root
 *	childclusters[]: Child clusters of this cluster.
 *	childnodes[]: Nodes that share this threat.
 *	magnitude:
 *	_markeroid:
 *	accordionopened: whether the NodeCluster accordion needs to be opened in Common Cause Failure view.
 * Methods:
 *	destroy(): destructor.
 *	setproject(pid): set the project to which this NodeCluster belongs to pid.
 *	setparent(nc): set the parent of this cluster to nc.
 *	settitle(str): sets the title (and the title of the thrass) to 't'.
 *	addthrass: adds a new, blank threat assessment to this cluster.
 *	addchildcluster(id): add a child cluster 'id' to this cluster.
 *	removechildcluster(id): remove child cluster 'id' from this cluster.
 *	addchildnode(nid): add a child node 'nid' to this cluster.
 *	removechildnode(nid): remove node 'nid' from this tree, and/or from any of its subtrees
 *	containsnode(nid): checks whether node 'nid' is contained in this cluster, or any subcluster.
 *	hasdescendant(ncid): checks whether cluster 'ncid' is a descendent of this cluster.
 *	root(): returns the ultimate root-cluster of this cluster.
 *	isroot(): true iff this cluster has no parent.
 *  isempty(): true iff this cluster has no parent, child clusters, nor child nodes.
 *	allnodes(): returns a flat array of all nodes in this tree.
 *	allclusters(): returns a flat aray of all clusters in this tree (including this cluster itself).
 *	normalize(): flattens child clusters with zero or one childclusters/nodes.
 *	calculatemagnitude(): compute this.magnitude and update DOM.
 *	setmarkeroid(oid): set this._markeroid to 'oid'.
 *	setmarker: set HTML of _markeroid based on this.magnitude.
 *	setallmarkeroid(): set _markeroid's of clusters in this tree based on 'prefix' and the id of the cluster.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
*/
var NodeCluster = function(type, id) {
	if (id!=null && NodeCluster._all[id]!=null)
		bugreport("NodeCluster with id "+id+" already exists","NodeCluster.constructor");
	this.id = (id==null ? nextUnusedIndex(NodeCluster._all) : id);
	this.type = type;
	this.title = "New node group "+this.id;
	this.project = null;
	this.parentcluster = null;
	this.childclusters = [];
	this.childnodes = [];
	this.thrass = null;
	this.magnitude = '-';
	this._markeroid = null;

	this.store();
	NodeCluster._all[this.id] = this;
};
NodeCluster._all = [];
NodeCluster.get = function(id) { return NodeCluster._all[id]; };

NodeCluster.addnode_threat = function(pid,nid,threattitle,threattype,duplicateok) {
	// Locate the corresponding cluster in the project. 
	// There should be at most one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.itemlength>1)
		bugreport("Multiple matches","NodeCluster.addnode_threat");
	if (it.notlast()) {
		var nc = it.getNodeCluster();
//console.debug("Adding node "+nid+" to cluster "+nc.id+" ["+threattitle+"|"+threattype+":"+nc.project+"]");
		if (nc.containsnode(nid)) {
			if (duplicateok!=true)
				bugreport("Duplicate node in cluster","NodeCluster.addnode_threat");
			return;
		}
	} else {
		nc = new NodeCluster(threattype);
		nc.setproject(pid);
		nc.settitle(threattitle);
//console.debug("Creating cluster with node "+nid+" as cluster "+nc.id+" ["+threattitle+"|"+threattype+":"+nc.project+"]");
		nc.addthrass();
		addTDomElements(nc);
	}
	nc.addchildnode(nid);
	repaintTDom(nc.id);
};
NodeCluster.addcomponent_threat = function(pid,cid,threattitle,threattype,duplicateok) {
	var cm = Component.get(cid);
	if (!cm)
		bugreport("No such component","NodeCluster.addcomponent_threat");
	// Locate the corresponding cluster in the project. 
	// There should be at most one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.itemlength>1)
		bugreport("Multiple matching clusters","NodeCluster.addcomponent_threat");
	if (it.notlast()) {
		var nc = it.getNodeCluster();
	} else {
		nc = new NodeCluster(threattype);
		nc.setproject(pid);
		nc.settitle(threattitle);
		nc.addthrass();
		addTDomElements(nc);
	}
	for (var i=0; i<(cm.single?1:cm.nodes.length); i++) {
		if (nc.containsnode(cm.nodes[i])) {
			if (duplicateok) continue;
			bugreport("Duplicate node in cluster","NodeCluster.addcomponent_threat");
		}
		nc.addchildnode(cm.nodes[i]);
	}
	repaintTDom(nc.id);
};
NodeCluster.removecomponent_threat = function(pid,cid,threattitle,threattype,notexistok) {
	// Locate the corresponding cluster in the project. 
	// There should be at most one.
	var it = new NodeClusterIterator({project: pid, isroot: true, type: threattype, title: threattitle});
	if (it.itemlength>1)
		bugreport("Multiple matching clusters","NodeCluster.removecomponent_threat");
	else if (it.itemlength==0) {
		if (!notexistok)
			bugreport("No matching cluster","NodeCluster.removecomponent_threat");
		return null;
	}
	var nc = it.getNodeCluster();
	var cm = Component.get(cid);
	if (!cm)
		bugreport("No such component","NodeCluster.removecomponent_threat");
	// If the node cluster is 'singular' then remove only the first node.
	for (var i=0; i< (cm.single?1:cm.nodes.length); i++) {
		if (!nc.containsnode(cm.nodes[i])) {
			if (notexistok) continue;
			bugreport("No such node in cluster","NodeCluster.removecomponent_threat");
		}
		nc.removechildnode(cm.nodes[i]);
	}
	nc.normalize();
	repaintTDom(nc.id);
	return nc;
};

NodeCluster.prototype = {
	destroy: function() {
		localStorage.removeItem(LS+'L:'+this.id);
		ThreatAssessment.get(this.thrass).destroy();
		NodeCluster._all[this.id]=null;
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
		var it = new NodeClusterIterator({project: this.project, isroot: true, type: this.type, title: str});
		if (it.notlast())
			bugreport("Already exists","NodeCluster.settitle");
		if (this.thrass!=null) {
			var ta = ThreatAssessment.get(this.thrass);
			ta.settitle(str);
			this.title=ta.title;
		} else
			this.title=str;
		this.store();
	},
	
	addchildcluster: function(childid) {
		if (DEBUG && this.childclusters.indexOf(childid)!=-1)
			bugreport("NodeCluster already contains that child cluster","NodeCluster.addchildcluster");
		this.childclusters.push(childid);
		NodeCluster.get(childid).setparent(this.id);
		this.store();
	},
	
	removechildcluster: function(childid) {
		var pos = this.childclusters.indexOf(childid);
		if (DEBUG && pos==-1)
			bugreport("NodeCluster does not contain that child cluster","NodeCluster.removechildcluster");
		this.childclusters.splice(pos,1);
		this.store();
	},
	
	addchildnode: function(childid) {
		if (DEBUG && this.childnodes.indexOf(childid)!=-1)
			bugreport("NodeCluster already contains that child node","NodeCluster.addchildnode");
		this.childnodes.push(childid);
		this.store();
	},
	
	removechildnode: function(childid) {
		var pos = this.childnodes.indexOf(childid);
		if (pos!=-1) {
			this.childnodes.splice(pos,1);
			this.store();
		} else {
			for (var i=0; i<this.childclusters.length; i++)
				NodeCluster.get(this.childclusters[i]).removechildnode(childid);
		}
	},

	containsnode: function(nid) {
		if (this.childnodes.indexOf(nid)>-1)
			return true;
		var contains=false;
		for (var i=0; !contains && i<this.childclusters.length; i++)
			contains = NodeCluster.get(this.childclusters[i]).containsnode(nid);
		return contains;
	},
	
	hasdescendant: function(ncid){
		if (this.childclusters.indexOf(ncid)!=-1) return true;
		for (var i=0; i<this.childclusters.length; i++) {
			if (NodeCluster.get(this.childclusters[i]).hasdescendant(ncid)) return true;
		}
		return false;
	},
	
	allnodes: function() {
		var arr = [].concat(this.childnodes);
		for (var i=0; i<this.childclusters.length; i++)
			arr = arr.concat(NodeCluster.get(this.childclusters[i]).allnodes());
		return arr;
	},
	
	allclusters: function() {
		var arr = [this.id];
		for (var i=0; i<this.childclusters.length; i++)
			arr = arr.concat(NodeCluster.get(this.childclusters[i]).allclusters());
		return arr;
	},
	
	addthrass: function() {
		var ta = new ThreatAssessment(this.type);
		this.thrass = ta.id;
		ta.setcluster(this.id);
		ta.settitle(this.title);
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
	
	normalize: function() {
		for (var i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			cc.normalize();
			if (cc.childclusters.length + cc.childnodes.length < 2) {
				// Assimilate the child cluster.
				if (cc.childclusters[0]) {
					var grandchild = NodeCluster.get(cc.childclusters[0]);
					this.childclusters.push(cc.childclusters[0]);
					grandchild.parentcluster = this.id;
					grandchild.store();
				}
				if (cc.childnodes[0])
					this.childnodes.push(cc.childnodes[0]);
				this.removechildcluster(cc.id);	// Includes this.store()
				cc.destroy();
			}
		}
		if (this.childclusters.length==1 && this.childnodes.length==0) {
			// Assimilate the child cluster.
			cc = NodeCluster.get(this.childclusters[0]);
			this.childclusters = [];
			for (i=0; i<cc.childclusters.length; i++) {
				grandchild = NodeCluster.get(cc.childclusters[i]);
				grandchild.parentcluster = this.id;
				grandchild.store();
				this.childclusters.push(cc.childclusters[i]);
			}
			this.childnodes = cc.childnodes;
			cc.destroy();
			this.store();
		}
	},
	
	calculatemagnitude: function() {
		if (this.thrass==null) {
			this.magnitude='-';
			return;
		}
		this.magnitude = ThreatAssessment.get(this.thrass).total;
		for (var i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			cc.calculatemagnitude();
			this.magnitude = ThreatAssessment.sum(this.magnitude,cc.magnitude);
		}
		this.setmarker();
	},
	
	isincomplete: function() {
		var ta = ThreatAssessment.get(this.thrass);
		if (ta.freq=="-" || ta.impact=="-")
			return true;
		for (var i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			if (cc.isincomplete())
				return true;
		}
		return false;
	},
	
	setmarkeroid: function(oid) {
		this._markeroid = oid;
		this.setmarker();
	},
	
	setmarker: function() {
		if (this._markeroid==null) return;
		var str = '<span class="Magnitude M'
				+ThreatAssessment.valueindex[this.magnitude]
				+'" title="'+ThreatAssessment.descr[ThreatAssessment.valueindex[this.magnitude]]+'">'+this.magnitude+'</span>';
		if (this.isroot() && this.isincomplete())
			str = '<span class="incomplete">' + _("Incomplete") + '</span>' + str;
		$(this._markeroid).html(str);
	},
	
	setallmarkeroid: function(prefix) {
		this.setmarkeroid(prefix+this.id);
		for (var i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			cc.setallmarkeroid(prefix);
		}
	},
	
	setaccordionopened: function(b) {
		this.accordionopened = b;
		this.store();
	},
	
	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.l=this.title;
		data.p=this.project;
		data.u=this.parentcluster;
		data.c=this.childclusters;
		data.n=this.childnodes;
		data.e=this.thrass;
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
		var i;
		for (i=0; i<this.childclusters.length; i++) {
			var cc = NodeCluster.get(this.childclusters[i]);
			if (!cc) {
				errors += offender+"contains a non-existing child cluster "+this.childclusters[i]+".\n";
				continue;
			}
			if (cc.parentcluster != this.id)
				errors += offender+"contains a child cluster "+this.childclusters[i]+" that does not refer back to it.\n";
			errors += cc.internalCheck();
		}
		for (i=0; i<this.childnodes.length; i++) {
			var rn = Node.get(this.childnodes[i]);
			if (!rn) {
				errors += offender+"contains a non-existing child node "+this.childnodes[i]+".\n";
				continue;
			}
		}
		var rc = NodeCluster.get(this.root());
		if (!rc)
			errors += offender+"does not have proper root.\n";
		var ta = ThreatAssessment.get(this.thrass);
		if (!ta) {
			errors += offender+"contains an nonexisting vuln assessment "+this.thrass+".\n";
		} else {
			if (ta.cluster!=this.id) 
				errors += offender+"has a member vuln assessment "+ta.id+" that doesn't refer back.\n";
			if (ta.component) 
				errors += offender+"has a member vuln assessment "+ta.id+" that also refers to a component.\n";
			if (ta.type!=this.type) 
				errors += offender+"has a member vuln assessment "+ta.id+" with a non-matching type.\n";
			if (ta.title!=this.title)
				errors += offender+"has a member vuln assessment "+ta.id+" with a different title.\n";
		}
		return errors;
	}
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * NodeClusterIterator: iterate over all NodeClusters of a project, optionally limited by status
 *
 * usage:
 * 		var it = new NodeClusterIterator({project: pid, parent: parid, type: 'tEQT', title: stringT});
 * 		for (it.first(); it.notlast(); it.next()) {
 *			var ncid = it.getNodeClusterid();
 *			var nc = it.getNodeCluster();
 *	 		:
 *		}
 */
var NodeClusterIterator = function(opt) {
	this.index = 0;
	this.item = [];
	for (var i=0,alen=NodeCluster._all.length; i<alen; i++) {
		var nc = NodeCluster._all[i];
		if (nc==null) continue;
		if (opt && opt.project!=undefined && nc.project!=opt.project) continue;
		if (opt && opt.parentcluster!=undefined && nc.parentcluster!=opt.parentcluster) continue;
		if (opt && opt.isroot!=undefined && nc.isroot()!=opt.isroot) continue;
		if (opt && opt.isstub!=undefined && (nc.childnodes.length+nc.childclusters.length<2)!=opt.isstub) continue;
		if (opt && opt.isempty!=undefined && (nc.childnodes.length+nc.childclusters.length==0)!=opt.isempty) continue;
		if (opt && opt.type!=undefined && nc.type!=opt.type) continue;
		if (opt && opt.title!=undefined && nc.title!=opt.title) continue;
		this.item.push(i);
	}
	this.itemlength = this.item.length;
};
NodeClusterIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	notlast: function() {return (this.index < this.itemlength);},
	getNodeCluster: function() {return NodeCluster.get( this.item[this.index] );},
	getNodeClusterid: function() {return this.item[this.index];},
	sortByName: function() {
		this.item.sort( function(a,b) {
			var na = NodeCluster.get(a);
			var nb = NodeCluster.get(b);
			return na.title.toLocaleLowerCase().localeCompare(nb.title.toLocaleLowerCase());
		});
	},
	sortByType: function() {
		this.item.sort( function(a,b) {
			var na = NodeCluster.get(a);
			var nb = NodeCluster.get(b);
			if (na.type<nb.type) return -1;
			if (na.type>nb.type) return 1;
			// When types are equal, sort alphabetically
			return na.title.toLocaleLowerCase().localeCompare(nb.title.toLocaleLowerCase());
		});
	},
	sortByLevel: function() {
		this.item.sort( function(a,b) {
			var na = NodeCluster.get(a);
			var nb = NodeCluster.get(b);
//			var ta = ThreatAssessment.get(na.thrass);
//			var tb = ThreatAssessment.get(nb.thrass);
//			var va = ThreatAssessment.valueindex[ta.total];
//			var vb = ThreatAssessment.valueindex[tb.total];
			var va = ThreatAssessment.valueindex[na.magnitude];
			var vb = ThreatAssessment.valueindex[nb.magnitude];
			if (va==1) va=8; // Ambiguous
			if (vb==1) vb=8;
			if (va!=vb)
				return vb - va;
			// When levels are equal, sort alphabetically
			return na.title.toLocaleLowerCase().localeCompare(nb.title.toLocaleLowerCase());
		});
	}	
};
