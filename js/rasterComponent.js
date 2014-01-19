/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * $Id: rasterComponent.js,v 1.1.1.1.4.8.2.3.2.8 2012/09/11 08:47:39 vriezekolke Exp $
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
 *	id: unique number
 *	title: retrieve current title
 *	project: project to which this component belongs
 *	thrass[]: array of ThrEvalation id's, holding the threat estimates
 *	nodes[]: array of Node objects that share this component.
 *	magnitude: overall vulnerability of this component
 *	single: true iff the component has a single physical existence (i.s.o. multiple identical copies)
 *	_markeroid: id of DOM object in which evaluation status is shown.
 *	accordionopened: whether the Component accordion needs to be opened in Single Failure view.
 * Methods:
 *	destroy(): destructor.
 *	absorbe(c): merge data from another component into this, then destroy() that other component
 *	mergeclipboard: paste ThreatAssessment.Clipboard into this. Returns the list of new TA's.
 *  _setalltitles:
 *	settitle(str): sets the header text to 'str'.
 *	setproject(pid): sets the project to pid (numerical).
 *	addnode(n.id): add a node to this component
 *	removenode(n.id): remove the node from this component
 *	addthrass(te): add the ThreatAssessment object.
 *	removethrass(te): remove the ThreatAssessment object.
 *	threatsnotevaluated: returns the numer of threats that have not been evaluated.
 *	adddefaultthreatevaluations(): copy threat evals from another component or checklists.
 *	calculatemagnitude: calculate the overall vulnerability of this component.
 *	setsingle(b): change singular/multiple flag (this.single) to 'b'.
 *	setmarkeroid(oid): change _markeroid and set status.
 *	setmarker: show/hide/set the status marker.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
*/
var Component = function(type, id) {
	if (type=='tACT')
		bugreport("attempt to create component for actor node","Component.constructor");
	if (type=='tNOT')
		bugreport("attempt to create component for a note","Component.constructor");
	if (id!=null && Component._all[id]!=null)
		bugreport("Component with id "+id+" already exists","Component.constructor");
	this.id = (id==null ? nextUnusedIndex(Component._all) : id);
	this.type = type;
	this.project = Project.cid;
	this.nodes = [];
	this.title = "Component " + Rules.nodetypes[this.type] + " " + this.id;	
	this.thrass = [];
	this.magnitude = '-';
	this.single = false;
	this._markeroid = null;

	this.store();
	Component._all[this.id] = this;
};
Component._all = [];
Component.ThreatsComponent = -1;
Component.get = function(id) { return Component._all[id]; };
Component.hasTitleTypeProject = function(str,typ,pid) {
	for (var i=0; i<Component._all.length; i++) {
		if (!Component._all[i]) continue;
		if (Component._all[i].title==str 
		 && Component._all[i].type==typ
		 && Component._all[i].project==pid) return i;
	}
	return -1;
};
Component.prototype = {
	destroy: function() {
		localStorage.removeItem(LS+'C:'+this.id);
		if (this.id==Component.ThreatsComponent)
			$("#componentthreats").dialog("close");
		for (var i=0; i<this.thrass.length; i++)
			ThreatAssessment.get(this.thrass[i]).destroy();
		Component._all[this.id]=null;
	},

	absorbe: function(cm) {
		// Merge all new threvals from cm into this. If both contain a threat with the
		// same name, then use the worst values from each
		for (var i=0; i<cm.thrass.length; i++) {
			var ta =  ThreatAssessment.get(cm.thrass[i]);
			for (var j=0; j<this.thrass.length; j++) {
				var ta2 = ThreatAssessment.get(this.thrass[j]);
				if (ta2.title==ta.title) break;
			}
			if (ta.title==ta2.title) {
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
		for (i=0; i<cm.nodes.length; i++) {
			rn = Node.get(cm.nodes[i]);
			this.addnode(rn.id);
//			rn.addtonodeclusters();
		}
		cm.nodes = [];
		cm.destroy();
	},

	mergeclipboard: function() {
		var newte = [];
		for (var j=0; j<ThreatAssessment.Clipboard.length; j++) {
			if (ThreatAssessment.Clipboard[j].y=='tUNK')
				bugreport("Wrong type in clipboard data","Component.mergeclipboard");
			// Try to find an identically named threat in our current list. If we are an
			// unknown link, then also the type must match. For types wireless/wired/eqt the
			// type will be converted to this.type anyway, so don't require the types to match.
			// Break as soon as we find a match.
			for (var i=0; i<this.thrass.length; i++) {
				var te = ThreatAssessment.get(this.thrass[i]);
				if (ThreatAssessment.Clipboard[j].t==te.title
				 && (this.type!='tUNK' || ThreatAssessment.Clipboard[j].y==te.type)
				) break;
			}
			if (i==this.thrass.length) {
				// Create a new threat evaluation
				// If we are an unknown link, then the type of our threats can (and should) be differet from
				// our own type. For wireless/wired/eqt, the threat type must be converted to our type.
				var th = new ThreatAssessment( (this.type=='tUNK' ? ThreatAssessment.Clipboard[j].y : this.type) );
				th.setcomponent(this.id);
				this.thrass.push(th.id);
				th.settitle(ThreatAssessment.Clipboard[j].t);
				th.setdescription(ThreatAssessment.Clipboard[j].d);
				th.setfreq(ThreatAssessment.Clipboard[j].p);
				th.setimpact(ThreatAssessment.Clipboard[j].i);
				th.setremark(ThreatAssessment.Clipboard[j].r);
				newte.push(th.id);
			} else {
				// Paste into existing threat evaluation
				te.description = prependIfMissing(ThreatAssessment.Clipboard[j].d, te.description);
				// If neither one is set, the result will be '-'.
				// If one is '-' but the other isn't, the result will be that non '-' value.
				// If both are set, the result will be the worst of both.
				if (te.freq=='-')
					te.setfreq(ThreatAssessment.Clipboard[j].p);
				else if (ThreatAssessment.Clipboard[j].p=='-')
					{ /* Do nothing */ /*jsl:pass*/ }
				else
					te.setfreq( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].p,te.freq) );
				if (te.impact=='-')
					te.setimpact(ThreatAssessment.Clipboard[j].i);
				else if (ThreatAssessment.Clipboard[j].i=='-')
					{ /* Do nothing */ /*jsl:pass*/ }
				else
					te.setimpact( ThreatAssessment.worst(ThreatAssessment.Clipboard[j].i,te.impact) );
				te.remark = prependIfMissing(ThreatAssessment.Clipboard[j].r, te.remark);
			}
		}
		this.store();
		return newte;
	},

	_setalltitles: function() {
		var len = this.nodes.length;
		if (len==0)
			return;
		else if (len==1)
			Node.get(this.nodes[0]).settitle(this.title,"");
		else {
		  for (var i=0; i<this.nodes.length; i++)
			Node.get(this.nodes[i]).settitle(this.title,(this.single?"":String.fromCharCode(String('a').charCodeAt(0)+i)));
		}
	},

	settitle: function(str) {
		this.title = trimwhitespace(str);
		this._setalltitles();
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
	
	addnode: function(id) {
		if (this.nodes.indexOf(id)!=-1)
			bugreport('node already belongs to component','Component.addnode');
		this.nodes.push(id);
		var nd = Node.get(id);
		if (!nd)
			bugreport('no such node','Component.addnode');
		nd.setcomponent(this.id);
		// Since the list of vulns on 'nd' may be different from those of 'this' component,
		// remove 'nd' from all node clusters, and re-add it to the ones it should belong to,
		// based on the new nd.component. Unless the component is singular.
		nd.removefromnodeclusters();
		if (!this.single)
			// If this is a 'single' node cluster, then only this.nodes[0] must be
			// present in the clusters.
			nd.addtonodeclusters();
		this._setalltitles();
		this.store();
		if (this.id==Component.ThreatsComponent)
			$("#componentthreats").dialog('option', 'title',
				'Vulnerability assessment for "'+H(this.title)+'" ' + (this.nodes.length>1 ? "("+this.nodes.length+" nodes)" : "")
			);
	},
	
	removenode: function(id) {
		if (this.nodes.indexOf(id)==-1)
			bugreport('node does not belong to component','Component.removenode');
		// When this component is 'single', only nodes[0] will be present in the NodeClusters.
		// If nodes[0] is removed, another node must be inserted as placeholder for the Component
		// in the node clusters.
		var i = this.nodes.indexOf(id);
		this.nodes.splice(i,1);
		if (this.nodes.length<2)
			this.single = false;
		this._setalltitles();
		if (i==0 && this.single) {
			// Removing the one node that was present in the node clusters
			var rn = Node.get(id);
			rn.removefromnodeclusters();			
			// Add a new placeholder into the clusters
			rn = Node.get(this.nodes[0]);
			rn.addtonodeclusters();
		}
		if (this.nodes.length==0)
			this.destroy();
		else {
			this.store();
			if (this.id==Component.ThreatsComponent)
				$("#componentthreats").dialog('option', 'title',
					'Vulnerability assessment for "'+H(this.title)+'" ' + (this.nodes.length>1 ? "("+this.nodes.length+" nodes)" : "")
				);
		}
	},
	
	addthrass: function(te) {
		this.thrass.push(te.id);
		te.setcomponent(this.id);
		for (var i=0; i<this.nodes.length; i++)
			NodeCluster.addnode_threat(this.project,this.nodes[i],te.title,te.type,false);
		this.calculatemagnitude();
		this.store();
	},
	
	removethrass: function(te) {
		this.thrass.splice( this.thrass.indexOf(te), 1 );
		this.calculatemagnitude();
		ThreatAssessment.get(te).destroy();
		this.store();
	},
	
	threatsnotevaluated: function() {
		var mustdoevals=0;
		for (var i=0; i<this.thrass.length; i++) {
			if (ThreatAssessment.get(this.thrass[i]).freq=='-' ||
				ThreatAssessment.get(this.thrass[i]).impact=='-')
				mustdoevals++;
		}
		return mustdoevals;
	},

	adddefaultthreatevaluations: function(id) {
		if (id!=null) {
			// Copy threat evaluations from Component id
			var te;
			var cm = Component.get(id);
			for (var i=0; i<cm.thrass.length; i++) {
				var oldte = ThreatAssessment.get(cm.thrass[i]);
				te = new ThreatAssessment(oldte.type);
				te.setcomponent(this.id);
				te.settitle(oldte.title);
				te.setdescription(oldte.description);
				te.setfreq(oldte.freq);
				te.setimpact(oldte.impact);
				te.setremark(oldte.remark);
				te.computetotal();
				this.thrass.push(te.id);
			}
		} else {
			// Copy default threats, preserving the order in which they appear in the project.
			var p = Project.get(Project.cid);
			for (i=0; i<p.threats.length; i++) {
				var th = Threat.get(p.threats[i]);
				if (th.type!=this.type && this.type!='tUNK')
					continue;
				// ThreatAssessments on a node/component of type tUNK will have the type of
				// the Threat, not tUNK. So a tUNK component will have TAs with a type that
				// differs from the node/component itself.
				te = new ThreatAssessment(th.type);
				te.setcomponent(this.id);
				te.settitle(th.title);
				te.setdescription(th.description);
				this.thrass.push(te.id);
			}
		}
		this.store();
	},

	calculatemagnitude: function() {
		if (this.thrass.length==0) {
			// Must be the same as default for new nodes, which also have no thrass[].
			this.magnitude='-';
			return;
		}
		this.magnitude = ThreatAssessment.get(this.thrass[0]).total;
		for (var i=1; i<this.thrass.length; i++)
			this.magnitude = ThreatAssessment.sum(
				this.magnitude,
				ThreatAssessment.get(this.thrass[i]).total
			);
		for (i=0; i<this.nodes.length; i++)
			Node.get(this.nodes[i]).setmarker();
	},
	
	setsingle: function(single) {
		var i, rn;
		var newval = (single===true);
		if (newval) {
			// Make sure that this component has at most one node per service
			var count = [];
			for (i=0; i<this.nodes.length; i++) {
				rn = Node.get(this.nodes[i]);
				if (count[rn.service]>0) {
					newval = false;
					break;
				} else {
					count[rn.service] = 1;
				}
			}
		}
		if (this.single && !newval) {
			// Change from single to multiple
			// Add all but the first node to all node clusters
			for (i=1; i<this.nodes.length; i++) {
				rn = Node.get(this.nodes[i]);
				rn.addtonodeclusters();
			}
		} else if (!this.single && newval) {
			// Change from multiple to single
			// Remove all but the first node from all node clusters
			for (i=1; i<this.nodes.length; i++) {
				rn = Node.get(this.nodes[i]);
				rn.removefromnodeclusters();
			}
		} else if (this.single != (single===true)) {
			// Disallow change, flash all visible nodes
			for (i=0; i<this.nodes.length; i++)
			  	$("#node"+this.nodes[i]).effect("pulsate", { times:2 }, 200);
			return;
		} else {
			// No change
			return;
		}
		this.single = newval;
		this._setalltitles();
		this.store();
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
		if (this.threatsnotevaluated()!=0)
			str = '<span class="incomplete">Incomplete</span>' + str;
		$(this._markeroid).html(str);
	},

	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.p=this.project;
		data.l=this.title;
		data.e=this.thrass;
		data.n=this.nodes;
		data.s=this.single;
		data.o=this.accordionopened;
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
		}
		for (i=0; i<this.thrass.length; i++) {
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
			if (!it.notlast()) {
				errors += offender+"has a vuln assessment "+ta.id+" that does not have a corresponding node cluster.\n";
				continue;
			}
			if (it.item.length>1) {
				errors += offender+"has a vuln assessment "+ta.id+" that has more than one corresponding node cluster.\n";
				continue;
			}
			var cc = it.getNodeCluster();
			cc = NodeCluster.get(cc.root());
			for (j=0; j<(this.single? 1 : this.nodes.length); j++) {
				if (!cc.containsnode(this.nodes[j]))
					errors += offender+"has a node "+rn.id+" that does not appear in the node cluster for "+H(ta.title)+" ("+H(ta.type)+").\n";
			}
		}
		// Check all nodes that claim to belong to this component
		it = new NodeIterator();
		for (it.first(); it.notlast(); it.next()) {
			rn = it.getnode();
			if (rn.component!=this.id) continue;
			if (this.nodes.indexOf(rn.id)==-1)
				errors += "Node "+rn.id+" claims to belong to component "+this.id+" but doesn't appear in the list.\n";
		}
		return errors;
	}
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * ComponentIterator: iterate over all components of a project
 *
 * usage:
 * 		var it = new ComponentIterator({project: ppppp, service: sssss, type: ttttt});
 * 		for (it.first(); it.notlast(); it.next()) {
 *			var cm = it.getcomponent();
 *	 		:
 *		}
 */
var ComponentIterator = function(opt) {
	this.index = 0;
	this.item = [];
	for (var i=0,alen=Component._all.length; i<alen; i++) {
		if (Component._all[i]==null) continue;
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
		if (ok && opt.service!=null) {
			occurs=false;
			for (j=0; !occurs && j<cm.nodes.length; j++)
				occurs = (Node.get(cm.nodes[j]).service==opt.service);
			ok = ok && occurs;
		}
		if (ok)
			this.item.push(i);
	}
};
ComponentIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	notlast: function() {return (this.index < this.item.length);},
	getcomponentid: function() {return this.item[this.index];},
	getcomponent: function() {return Component.get( this.item[this.index] );},
	sortByName: function() {
		this.item.sort( function(a,b) {
			var ca = Component.get(a);
			var cb = Component.get(b);
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	},
	sortByType: function() {
		this.item.sort( function(a,b) {
			var ca = Component.get(a);
			var cb = Component.get(b);
			if (ca.type<cb.type) return -1;
			if (ca.type>cb.type) return 1;
			// When types are equal, sort alphabetically
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	},
	sortByLevel: function() {
		this.item.sort( function(a,b) {
			var ca = Component.get(a);
			var cb = Component.get(b);
			var va = ThreatAssessment.valueindex[ca.magnitude];
			var vb = ThreatAssessment.valueindex[cb.magnitude];
			if (va==1) va=8; // Ambiguous
			if (vb==1) vb=8;
			if (va!=vb)
				return vb - va;
			// When levels are equal, sort alphabetically
			return ca.title.toLocaleLowerCase().localeCompare(cb.title.toLocaleLowerCase());
		});
	}	
};
