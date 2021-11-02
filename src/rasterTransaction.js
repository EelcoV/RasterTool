/* Copyright (C) Eelco Vriezekolk, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals _, Component, ComponentIterator, DEBUG, H, NodeCluster, NodeClusterIterator, PaintAllClusters, Project, RefreshNodeReportDialog, Service, Threat, ThreatAssessment, ThreatIterator, autoSaveFunction, bugreport, checkForErrors, isSameString, exportProject, nid2id, refreshComponentThreatAssessmentsDialog, setModified, refreshChecklistsDialog, repaintCluster
*/

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Transaction: object representing an undoable, shareable action.
 *
 * Transaction form a doubly linked list with three pointers (class properties):
 *  base: the start of the list, a special transaction with id==null
 *  current: the most recently performed transaction
 *  head: the most recently posted transaction
 * When undoing/redoing, 'current' steps through the list while 'base' and 'head' remain unchanged.
 *
 * Class properties
 *  base: the start of the list, a special transaction with id==null
 *  current: the most recently performed transaction
 *  head: the most recently posted transaction
 * Class methods
 *  undo: undo the latest transaction (move Transaction.current backwards)
 *  redo: redo the most recently undone transaction (move Transaction.current forwards)
 *  updateUI: update the status of the Undo and Redo buttons
 * Instance properties:
 *  kind: (String) the type of transaction
 *  descr: (String, optional) UI description of the transaction
 *  timestamp: (integer) time of this transaction's creation
 *  chain: (boolean) treat this and the next transaction as one, when (un)doing.
 *  prev: previous
 *  undo_data: (any) an object or literal containing all information to undo the transaction
 *  do_data: (any) an object or literal containing all information to perform the transaction
 * Instance methods:
 *  perform(data): perform the action using data; data defaults to this.do_data
 *  undo: perform the action using this.undo.
 */
var Transaction = function(knd,undo_data,do_data,descr,chain) {
	this.kind = knd;
	this.descr = (descr ? descr : knd);
	this.chain = (chain ? chain : false);
	this.timestamp = Date.now();
	this.undo_data = undo_data;
	this.do_data = do_data;
	if (this.kind==null) {
		this.prev = null;
		this.next = null;
		return;
	}
	// Perform this action, and make it the head of the transaction list.
	// If there are any actions between current and head, then these are discarded
	Transaction.current.next = this;
	this.prev = Transaction.current;
/* Test!
 *
 * This block, and undo and redo below, contain a lot of debugging code. The transaction
 * is rolled back, to check that there are no unaccounted side-effects. When this new
 * structure is working, the code can be commented out, or removed.
 */
checkForErrors();
let S1 = exportProject(Project.cid);
	this.perform();
	transactionCompleted("+" + (this.chain?"↓":" ") + " " + this.kind + "  (do data "+JSON.stringify(do_data).length+" bytes, undo data "+JSON.stringify(undo_data).length+" bytes)");

checkForErrors();
let S2 = exportProject(Project.cid);
this.undo();
checkForErrors();
let S3 = exportProject(Project.cid);
this.perform();
checkForErrors();
let S4 = exportProject(Project.cid);
if (S1!=S3) {
	logdiff(S1,S3,"in new: perform + undo != initial situation");
}
if (S2!=S4) {
	logdiff(S2,S4,"in new: perform != perform + undo + redo");
}
/* ^^ end test */
	
	Transaction.current = this;
	Transaction.head = this;
	Transaction.updateUI();
};

Transaction.base = new Transaction(null,null,null);
Transaction.current = Transaction.base;
Transaction.head = Transaction.base;

Transaction.updateUI = function() {
	if (Transaction.current==Transaction.base) {
		$('#undobutton').removeClass('possible');
		$('#undobutton').attr('title', _("Undo"));
	} else {
		$('#undobutton').addClass('possible');
		$('#undobutton').attr('title', _("Undo") + ' ' + Transaction.current.descr);
	}
	if (Transaction.current==Transaction.head) {
		$('#redobutton').removeClass('possible');
		$('#redobutton').attr('title', _("Redo"));
	} else {
		$('#redobutton').addClass('possible');
		$('#redobutton').attr('title', _("Redo") + ' ' + Transaction.current.next.descr);
	}
};

Transaction.undo = function() {
	if (Transaction.current==Transaction.base)  return;

	do {
// Test!
checkForErrors();
let S1 = exportProject(Project.cid);
		Transaction.current.undo();
checkForErrors();
let S2 = exportProject(Project.cid);
Transaction.current.perform();
checkForErrors();
let S3 = exportProject(Project.cid);
Transaction.current.undo();
checkForErrors();
let S4 = exportProject(Project.cid);
if (S1!=S3) {
	logdiff(S1,S3,"in undo: undo,redo != nil");
} else if (S2!=S4) {
	logdiff(S2,S4,"in undo: redo,undo != nil");
}
		transactionCompleted("<"+ (Transaction.current.chain?"↑":" ") +" "+Transaction.current.kind);
		Transaction.current = Transaction.current.prev;
	} while (Transaction.current.chain==true);
	Transaction.updateUI();
};

Transaction.redo = function() {
	if (Transaction.current==Transaction.head)  return;

	do {
// Test!
checkForErrors();
let S1 = exportProject(Project.cid);
		Transaction.current = Transaction.current.next;
		Transaction.current.perform();
checkForErrors();
let S2 = exportProject(Project.cid);
Transaction.current.undo();
checkForErrors();
let S3 = exportProject(Project.cid);
Transaction.current.perform();
checkForErrors();
let S4 = exportProject(Project.cid);
if (S1!=S3) {
	logdiff(S1,S3,"in redo: redo,undo != nil");
} else if (S2!=S4) {
	logdiff(S2,S4,"in redo: undo,redo != nil");
}
		transactionCompleted(">"+ (Transaction.current.chain?"↓":" ") +" "+Transaction.current.kind);
	} while(Transaction.current.chain==true);
	Transaction.updateUI();
};


Transaction.prototype = {
	undo: function() {
		this.perform(this.undo_data);
	},

	perform: function(data) {
		if (!data)  data = this.do_data;
		switch (this.kind) {

		case 'classSingular': {
			// Change the class from regular to singular, and vice verse
			// data: array of objects; each object has these properties
			//  id: id of the component of the class
			//  singular: true iff the component should be a singular class, false otherwise
			for (const d of data) {
				let cm = Component.get(d.id);
				cm.setsingle(d.singular);
			}
			break;
		}

		case 'classTitle': {
			// Edit the title of a node class
			// data: array of objects; each object has these properties
			//  id: id of the component of the class
			//  title: title of the node class
			for (const d of data) {
				let cm = Component.get(d.id);
				cm.setclasstitle(d.title);
			}
			break;
		}

		case 'clusterStructure': {
			// Edit the structure of a root cluster and its structure
			// data: array of objects; each object has these properties
			//  structure: information on restoring the cluster (no nodes added or removed)
			//  root: id of the root cluster
			//	destroy: id of a cluster to be deleted.
			// or
			//  remove: id of a cluster to be removed. 
			// or
			//  move_from: cluster to be moved
			//  move_to: new parent of that cluster (destination)
			// or
			//  create: id of a new cluster
			//	title, type, project, parent, nodes, thrass: properties of the new cluster
			// or
			//	move: list of node ids
			//	to: id of node cluster to move these nodes into
			for (const d of data) {
				if (d.structure) {
					rebuildCluster(d.structure);
					repaintCluster(d.root);
					if (d.destroy) NodeCluster.get(d.destroy).destroy();
				} else if (d.remove) {
					let cluster = NodeCluster.get(d.remove);
					let root = NodeCluster.get(cluster.root());
					let parent = NodeCluster.get(cluster.parentcluster);
					for (const nid of cluster.childnodes) parent.addchildnode(nid);
					for (const cid of cluster.childclusters) parent.addchildcluster(cid);
					parent.removechildcluster(cluster.id);
					cluster.destroy();
					root.normalize();
					root.calculatemagnitude();
					repaintCluster(root.id);
				} else if (d.move_from) {
					let from_cluster = NodeCluster.get(d.move_from);
					let to_cluster = NodeCluster.get(d.move_to);
					let parent = NodeCluster.get(from_cluster.parentcluster);
					let root = NodeCluster.get(from_cluster.root());
					parent.removechildcluster(from_cluster.id);
					to_cluster.addchildcluster(from_cluster.id);
					root.normalize();
					root.calculatemagnitude();
					repaintCluster(root.id);
				} else if (d.create) {
					let nc = new NodeCluster(d.type,d.create);
					nc.setproject(d.project);
					nc.setparent(d.parent);
					if (d.title) nc.settitle(d.title);
					nc.addthrass(d.thrass);
					let parent = NodeCluster.get(d.parent);
					parent.addchildcluster(nc.id);
					let root = NodeCluster.get(nc.root());
					for (const n of d.nodes) {
						root.removechildnode(n);
						nc.addchildnode(n);
					}
					root.normalize();
					root.calculatemagnitude();
					repaintCluster(root.id);
				} else if (d.move!=null) {
					let nc = NodeCluster.get(d.to);
					let root = NodeCluster.get(nc.root());
					for (const n of d.move) {
						root.removechildnode(n);
						nc.addchildnode(n);
					}
					root.normalize();
					root.calculatemagnitude();
					repaintCluster(root.id);
				} else {
					bugreport('unknown action', 'Transaction.clusterStructure');
				}
			}
			break;
		}
		
		case 'clusterTitle': {
			// Edit the title of a cluster
			// data: array of objects; each object has these properties
			//  id: id of the cluster
			//  title: title of the cluster
			for (const d of data) {
				let nc = NodeCluster.get(d.id);
				nc.settitle(d.title);
				$('#dthE_ccf'+nc.root()+'name'+nc.thrass).html(H(nc.title));
				$('#litext'+nc.id).html(H(nc.title));
			}
			break;
		}

		case 'compVulns': {
			// Change the order of threatassessments
			// data: array of objects; each object has these properties
			//  id: id of the component
			//  thrass: list of ids of the threatassessments of the component
			for (const d of data) {
				let c = Component.get(d.id);
				c.thrass = d.thrass;
				c.store();
				c.repaint();
			}
			break;
		}

		case 'labelEdit': {
			// Edit the project color labels
			// data: array of objects; each object has these properties
			//  id: id of the project
			//  labels: array of the labels of the project
			for (const d of data) {
				let p = Project.get(d.id);
				p.labels = d.labels.slice();
				p.store();
			}
			break;
		}

		case 'nodeConnect': {
			// (Dis)connect nodes
			// data: array of objects; each object has these properties
			//  id: id of one node
			//  otherid: id of the other node
			//  connect: true for connecting, false for disconneting
			for (const d of data) {
				let nd1 = Node.get(d.id);
				let nd2 = Node.get(d.otherid);
				if (d.connect) {
					nd1.attach_center(nd2);
					nd1.setmarker();
					nd2.setmarker();
				} else {
					let jsP = Service.get(nd1.service)._jsPlumb;
					for (const conn of jsP.getConnections({scope:'center'})) {
						// In jsPlumb, connections have a source and target, but in Raster connections are symmetric
						let src = nid2id(conn.sourceId);
						let dst = nid2id(conn.targetId);
						if (src==d.id && dst==d.otherid
						 || src==d.otherid && dst==d.id
						) {
							jsP.deleteConnection(conn);
							nd1.detach_center(nd2);
						}
					}
				}
			}
			break;
		}

		case 'nodeCreateDelete': {
			// Create or delete a node
			//  Deleting one or more nodes is hard, because it can have a huge impact on node clusters. Clusters must
			//  have at least 2 childnodes or -clusters; if not, they will be normalized (removed). When undoing the
			//  deletion of multiple nodes, their order of recreation is important. Recreated nodes must be re-added
			//  to their previous clusters, which may not exist anymore. Simply recreating their cluster is not always
			//  possible, as the parent cluster also may not exist.
			//  We solve this problem by storing the entire cluster structure, for all root clusters.
			//  When creating a new node, there is no problem in undoing (i.e. deleting that node). Creation of nodes
			//  does not modify the cluster structure, the node is always added to the root clusters of its
			//  vulnerabilities, which are guaranteed to exist, and the node can therefore always be safely deleted.
			//
			// data: an object with these two properties
			//  nodes: array of objects; each object has these properties
			//   id: id of the node; this is the *only* node property when deleting the node
			//   type: type of the node
			//   title: name of the node
			//   suffix: suffix of the node
			//   service: service to which the node belongs
			//   label: color of the node
			//   x, y: position of the node
			//   width, height: size of the node (optional)
			//   connect: array of node IDs to connect to
			//   component: id of the component object
			//   thrass: array of objects containing info on the vulnerabilities:
			//     id, type, title, description, freq, impact, remark: as of the threat assessment
			//   accordionopened: state of the component in Single Failures view
			//   single: id of the representing node iff single, or false iff not single
			//  cluster: an array of objects with the following properties (may be absent only if creating tACT or tNOT)
			//    id: ID of the cluster object
			//    title: title of the cluster
			//    project: project to which this cluster belongs
			//    parent: ID of the parent cluster (null, if root cluster)
			//    thrass: object containing info on the threat assessment for the cluster (as see above)
			//    accordionopened: cluster is folded open in CCF view
			//    childnode: array of IDs of all child nodes of this cluster
			//    childcluster: object containing the same properties (except childnode/childcluster)
			for (const d of data.nodes) {
				if (d.type==null) {
					// Delete the node
// Change to true when not debugging
					Node.get(d.id).destroy(false);
					continue;
				}

				let rn = new Node(d.type, d.service, d.id);
				rn.iconinit();
				rn.title = d.title;
				if (d.suffix!=null)  rn.suffix = d.suffix;
				if (d.label!=null)  rn.color = d.label;
				if (d.width!=null)  rn.position.width = d.width;
				if (d.height!=null)  rn.position.height = d.height;
				rn.setposition(d.x,d.y);
				rn.store();
// Change to true when not debugging
				rn.paint(false);
				if (d.type=='tNOT' || d.type=='tACT')  continue;

				let cm = Component.get(d.component);
				if (!cm) {
					cm = new Component(d.type, rn.project, d.component);
					for (const t of d.thrass) {
						let ta = new ThreatAssessment(t.type, t.id);
						ta.settitle(t.title);
						ta.setdescription(t.description);
						ta.setremark(t.remark);
						ta.setfreq(t.freq);
						ta.setimpact(t.impact);
						cm.addthrass(ta);
					}
					cm.accordionopened = d.accordionopened;
					cm.title = d.title;
				}
				cm.single = (d.single ? d.single!=false : false);
				cm.addnode(d.id, (d.id==d.single));
				cm.repaintmembertitles();
			}
			// Loop again, adding connections
			for (const d of data.nodes) {
				if (d.type==null)  continue;
				let rn = Node.get(d.id);
				if (d.connect!=null) {
					for (const n of d.connect) {
						// Skip if already connected, to avoid duplicate connections
						if (rn.connect.indexOf(n)!=-1) continue;
						let othernode = Node.get(n);
						rn.attach_center(othernode);
						othernode.setmarker();
					}
				}
				rn.setmarker();
			}

			for (const d of data.clusters) {
				rebuildCluster(d);
			}
			let it = new NodeClusterIterator({project: Project.cid, isroot: true});
			for (const cl of it) {
				repaintCluster(cl.id);
			}
			break;
		}

		case 'nodeGeometry': {
			// Change the size and/or position of nodes
			// data: array of objects; each object has these properties
			//  id: id of the node
			//  x, y: position of the node
			//  width, height: size of the node (optional)
			for (const d of data) {
				let rn = Node.get(d.id);
				if (d.width && d.height) {
					rn.position.width = d.width;
					rn.position.height = d.height;
				}
				rn.setposition(d.x,d.y);
			}
			break;
		}

		case 'nodeLabel': {
			// Change the label color of nodes
			// data: array of objects; each object has these properties
			//  id: id of the node
			//  label: color of the node
			for (const d of data) {
				let rn = Node.get(d.id);
				rn.setlabel(d.label);
			}
			break;
		}

		case 'nodeSuffix': {
			// Edit the suffix of a node in a class
			// data: array of objects; each object has these properties
			//  id: id of the node
			//  suffix: suffix of the node
			for (const d of data) {
				let rn = Node.get(d.id);
				let cm = Component.get(rn.component);
				for (const i of cm.nodes) {
					if (i==rn.id) continue;
					let nn = Node.get(i);
					if (nn.suffix==d.suffix) {
						nn.settitle(nn.title,rn.suffix);
					}
				}
				rn.settitle(rn.title,d.suffix);
			}
			break;
		}

		case 'nodeTitle': {
			// Change the name of a node
			// What can change, in addition to the node title, when you rename one single node?
			// 1- nothing (actor, notes)
			// 2- only the component title is changed (all other types, when no classes are involved)
			// 3- its old component loses a node, and a fresh component is created
			// 4- its old component loses a node and stops being a class; a fresh component is created
			// 5- its old component loses a node, the node gains a suffix and becomes part of a class
			// 6- its old component loses a node and stops being a class; the node gains a suffix and becomes part of a class
			// data: array of objects; each object has these properties (some properties are optional)
			//  id: id of the node
			//  title: title of the node
			//  suffix: suffix of the node
			//  thrass: array of threat assessments when the component needs to be created
			//		id, title, description, freq, impact, remark: as of the threat assessment
			//  component: id of the component
			//	accordionopened: folding state of the component
			//	single: class-type of the component
			//	asproxy: node should be added as proxy for the class to which it will belong
			for (const d of data) {
				let rn = Node.get(d.id);
				let cm;
				if (rn.type=='tNOT' || rn.type=='tACT') {
					rn.settitle(d.title);
					continue;
				}
				if (!d.component) {
					// Simple case, no classes involved. Set title on component and its node
					cm = Component.get(rn.component);
					cm.setclasstitle(d.title);
				} else {
					// More complex cases
					cm = Component.get(d.component);
					if (!cm) {
						// create a new component
						cm = new Component(rn.type,rn.project,d.component);
						cm.title = d.title;
						for (const t of d.thrass) {
							let ta = new ThreatAssessment(t.type, t.id);
							ta.settitle(t.title);
							ta.setdescription(t.description);
							ta.setremark(t.remark);
							ta.setfreq(t.freq);
							ta.setimpact(t.impact);
							cm.addthrass(ta);
						}
					}
					if (d.component!=rn.component) {
						let oldcm = Component.get(rn.component);
						oldcm.removenode(rn.id);
						oldcm.repaintmembertitles();
					}
					if (d.accordionopened) { cm.accordionopened = (d.accordionopened===true); }
					if (d.single) { cm.single = (d.single===true); }
					if (cm.nodes.indexOf(rn.id)==-1) {
						cm.addnode(rn.id, d.asproxy);
					}
					rn.settitle(d.title,d.suffix);
					rn.setmarker();
					cm.repaintmembertitles();
				}
				RefreshNodeReportDialog();
				if (!d.clusters) { d.clusters = []; }
				for (const cl of d.clusters) {
					rebuildCluster(cl);
				}
				// Also repaint clusters in which this node appears
				for (const thid of cm.thrass) {
					let ta = ThreatAssessment.get(thid);
					let it = new NodeClusterIterator({project: cm.project, title: ta.title, type: ta.type});
					for (const nc of it) {
						repaintCluster(nc.id);
					}
				}
			}
			break;
		}

		case 'serviceCreate': {
			// Add/remove service
			// data: array of objects; each object has these properties
			//  id: id of service
			//  project: project to which the service is to belong
			//  index: position of this service within the project
			//  title: title of the new service; this is null for undo data
			for (const d of data) {
				let p = Project.get(d.project);
				if (!d.title) {
					// this is undo data
					p.removeservice(d.id);
					continue;
				}
				let s = new Service(d.project,d.id);
				p.addservice(s.id,d.index);
				s.settitle(d.title);
				if (d.project==Project.cid) {
					s.load();
					$('#diagramstabtitle'+s.id).trigger('click');
				}
			}
			break;
		}

		case 'serviceRename': {
			// Change the name of a service
			// data: array of objects; each object has these properties
			//  id: id of service
			//  title: title of the new service
			for (const d of data) {
				let s = Service.get(d.id);
				s.settitle(d.title);
			}
			break;
		}

		case 'serviceReorder': {
			// Change the order of services on the diagrams and single failures tabs.
			// data: a single object containing these fields:
			//	project: the id of the project
			//	list: the re-ordered list of services
			// No services will or should be added or removed in this transaction.
			let p = Project.get(data.project);
			
			p.services = data.list;

			// Remove all service tabs on Diagrams and Single Failures, and re-create.
			$('#bottomtabssf').empty();
			$('#bottomtabsdia').empty();
			for (const sid of data.list) {
				var s = Service.get(sid);
				s._addtabsinglefs_tabonly();
				s._addtabdiagrams_tabonly();
			}
			p.store();
			$('#diagrams_body').tabs('refresh');
			$('#singlefs_body').tabs('refresh');
			break;
		}

		case 'swapProxy': {
			// Change the proxy-node used in clusters on behalf of a singular class.
			// Performing this transaction twice restores the original situation.
			// data: array of component-ids
			for (const d of data) {
				let cm = Component.get(d);
				// Change the order for the nodes of the component
				let oldid = cm.nodes[0];
				let newid = cm.nodes[1];
				cm.nodes[0] = newid;
				cm.nodes[1] = oldid;
				cm.store();
				// Make changes to all clusters
				let it = new NodeClusterIterator({project: cm.project, match: cm.type});
				for (const nc of it) {
					nc.childnodes.forEach(function(v,i,a) { if (a[i]==oldid) a[i]=newid; });
					nc.store();
					repaintCluster(nc.root());
				}
			}
			break;
		}

		case 'threatAssessDetails': {
			// Change the details of a ThreatAssessment
			// data: array of objects; each object has these properties
			//	threat: id of the ThreatAssessment
			//	freq: frequency-value of the threatassessment
			//	impact: impact-value of the threatassessment
			//	remark: remark of the threatassessment
			//  component, cluster: (either/or) the object to which this threatassessment belongs
			for (const d of data) {
				let ta = ThreatAssessment.get(d.threat);
				if (d.remark!=null)  ta.setremark(d.remark);
				if (d.freq!=null)  ta.setfreq(d.freq);
				if (d.impact!=null)  ta.setimpact(d.impact);
				if (ta.cluster) {
					repaintCluster(NodeCluster.get(ta.cluster).root());
				} else {
					Component.get(ta.component).repaint();
				}
			}
			break;
		}

		case 'threatAssessCreate': {
			// Create or remove a ThreatAssessment
			// data: array of objects; each object has these properties
			//	component: component on which to create (or delete) the threatassessment
			//  threat: ID of the ThreatAssessment to create (or delete)
			//	type: type of the ThreatAssessment
			//		Delete when type is null, create when type is not null
			//	freq: frequency-value of the threatassessment
			//	impact: impact-value of the threatassessment
			//	remark: remark of the threatassessment
			//  description: description of the threatassessment
			//  title: name of the threatassessment
			//  index: position of the threatassessment within the component
			//  clid: id of the new root cluster (when adding a new threat and assessment)
			//  thrid: id of the threat assessment of the new root cluster
			//  cluster: object describing the cluster, its subclusters, childnodes etc. Used on undo, see nodeCreateDelete.
			for (const d of data) {
				let cm = Component.get(d.component);
				if (d.type) {
					// Create/add
					// ThreatAssessment
					let ta = new ThreatAssessment(d.type,d.threat);
					if (d.title!=null)  ta.settitle(d.title);
					if (d.description!=null)  ta.setdescription(d.description);
					if (d.remark!=null)  ta.setremark(d.remark);
					if (d.freq!=null)  ta.setfreq(d.freq);
					if (d.impact!=null)  ta.setimpact(d.impact);
					// Root cluster
					if (d.clid && !NodeCluster.get(d.clid)) {
						let nc = new NodeCluster(d.type,d.clid);
						nc.setproject(cm.project);
						nc.settitle(ta.title);
						nc.addthrass(d.thrid);
					}
					// Update component
					cm.addthrass(ta,d.index);
				} else {
					// Delete/remove
					let th = ThreatAssessment.get(d.threat);
					cm.removethrass(d.threat);
					NodeCluster.removecomponent_threat(cm.project,th.component,th.title,th.type);
					$('#dthdia'+'_'+th.id).remove();
					$('#dthsfa'+'_'+th.id).remove();
					cm.setmarker();
				}
				if (d.cluster) {
					rebuildCluster(d.cluster);
					let cl = NodeCluster.get(d.cluster.id);
					repaintCluster(cl.id);
				}
				cm.repaint();
			}
			break;
		}

		case 'threatCreate': {
			// Add (or remove) a default threat to (or from) a checklist, or a vulnerability to acomponent, and update all UI
			// data: array of objects; each object has these properties
			//  create: true when adding, false when removing threat(assessment)
			//  component: id of the component to which a ThreatAssessment should be added (or removed, when type==null)
			//	project: id of the project in which to edit; either .component or .project must be defined
			//	threat: id of the checklist threat (new, or to be removed when type==null)
			//		or  id of the component's ThreatAssessment
			//  component: id of the component to which a ThreatAssessment should be added (or removed, when type==null)
			//		*either* threat&project *or* component should be specified
			//	index: position of the threat(assessment) within the project (component)
			//	type: type of the threat(assessment) (only wired, wireless, equipment allowed)
			//	title: title of the threat(assessment)
			//  cluster: id of the new cluster
			//  clusterthrid: id of the ThreatAssessment of the cluster
			//	description: description of the threat(assessment)
			//	tdescription: descriptopm of the cluster threat
			//	freq: frequency-value of the threatassessment
			//	impact: impact-value of the threatassessment
			//	remark: remark of the threatassessment
			for (const d of data) {
				if (d.component) {
					// Add/remove a single vulnerability to/from a component
					let cm = Component.get(d.component);
					if (d.create) {
						var ta = new ThreatAssessment(d.type,d.threat);
						if (d.title!=null)  ta.settitle(d.title);
						if (d.description!=null)  ta.setdescription(d.description);
						if (d.remark!=null)  ta.setremark(d.remark);
						if (d.freq!=null)  ta.setfreq(d.freq);
						if (d.impact!=null)  ta.setimpact(d.impact);
						cm.addthrass(ta,d.index);
					} else {
						let ta = ThreatAssessment.get(d.threat);
						cm.removethrass(ta.id);
						ta.destroy();
					}
					// refresh UI
					cm.repaint();
				} else {
					// Add/remove a default vulnerability to/from the checklist and all matching components
					if (d.create) {
						let th = new Threat(d.project,d.type,d.threat);
						if (d.title!=null)  th.title = d.title;
						if (d.description!=null)  th.description = d.description;
						th.store();
						let p = Project.get(d.project);
						p.addthreat(th.id,d.cluster,d.clusterthrid,d.index);
						let ta = ThreatAssessment.get(d.clusterthrid);
						if (d.tdescription!=null)  ta.setdescription(d.tdescription);
						if (d.remark!=null)  ta.setremark(d.remark);
						if (d.freq!=null)  ta.setfreq(d.freq);
						if (d.impact!=null)  ta.setimpact(d.impact);
					} else {
						let th = Threat.get(d.threat);
						let p = Project.get(th.project);
						p.removethreat(th.id);
						let cl = NodeCluster.get(d.cluster);
						cl.destroy();
					}
					// refresh UI
					refreshChecklistsDialog(d.type,true);
					let it = new ComponentIterator({project: d.project, match: d.type});
					for (const cm of it) {
						cm.repaint();
					}
					PaintAllClusters();
				}
			}
			break;
		}

		case 'threatRename': {
			// Global edit of title and description of vulnerabilities and node templates
			// data: array of objects; each object has these properties
			//	project: id of the project in which to edit
			//	type: type of the vulnerability (only wired, wireless, equipmemt allowed)
			//	old_t: previous title (may be null, indicating no change)
			//	old_d: previous description (may be null, indicating no change)
			//	new_t: changed title
			//	new_d: changed description
			for (const d of data) {
				let it;
				if (d.type!='tWLS' && d.type!='tWRD' && d.type!='tEQT') {
					bugreport("invalid type","Transaction.threatRename");
					return;
				}

				it = new ThreatIterator(d.project,d.type);
				for (const th of it) {
					if (d.old_t && isSameString(th.title,d.old_t)) {
						th.settitle(d.new_t);
						$('#thname'+th.id).html(H(d.new_t));
					}
					if (d.old_d && isSameString(th.description,d.old_d)) {
						th.setdescription(d.new_d);
						$('#thdesc'+th.id).html(H(d.new_d));
					}
				}

				it = new ComponentIterator({project: d.project, match: d.type});
				for (const cm of it) {
					for (const t of cm.thrass) {
						let ta = ThreatAssessment.get(t);
						if (d.old_t && isSameString(ta.title,d.old_t)) {
							ta.settitle(d.new_t);
						}
						if (d.old_d && isSameString(ta.description,d.old_d)) {
							ta.setdescription(d.new_d);
						}
					}
					cm.repaint();
				}

				it = new NodeClusterIterator({project: d.project});
				for (const cl of it) {
					let ta = ThreatAssessment.get(cl.thrass);
					let repaint = false;
					if (d.old_t && isSameString(cl.title,d.old_t)) {
						cl.settitle(d.new_t);
						repaint = true;
					}
					if (d.old_d && isSameString(ta.description,d.old_d)) {
						ta.setdescription(d.new_d);
						repaint = true;
					}
					if (repaint) {
						repaintCluster(cl.root());
					}
				}
			}
			break;
		}

		case 'threatReorder': {
			// Global change in the order of checklist vulnerabilities
			// data: a single object containing these fields:
			//	project: the id of the project
			//	list: the re-ordered list of threats
			// No threats will or should be added or removed in this transaction.
			let p = Project.get(data.project);
			// Compile arrays before and after move. With this information we can repaint
			// only the threat panel that was modified, and we avoid repainting the ones that
			// dit not change.
			let old_tWLS=[], old_tWRD=[], old_tEQT=[];
			let new_tWLS=[], new_tWRD=[], new_tEQT=[];
			for (const thid of p.threats) {
				let th = Threat.get(thid);
				switch (th.type) {
					case 'tWLS': old_tWLS.push(thid); break;
					case 'tWRD': old_tWRD.push(thid); break;
					case 'tEQT': old_tEQT.push(thid); break;
				}
			}
			for (const thid of data.list) {
				let th = Threat.get(thid);
				if (!th) {
					bugreport('unknown threat assessment', 'Transaction.threatReorder');
					return;
				}
				switch (th.type) {
					case 'tWLS': new_tWLS.push(thid); break;
					case 'tWRD': new_tWRD.push(thid); break;
					case 'tEQT': new_tEQT.push(thid); break;
				}
			}
			// if arrays old_tWLS and new_tWLS are not equal
			if (!old_tWLS.every( function(v,i) { new_tWLS[i]==v; } )) {
				// repaint the tWLS panel
				$('#tWLSthreats').empty();
				for (const thid of new_tWLS) Threat.get(thid).addtablerow('#tWLSthreats');
			}
			if (!old_tWRD.every( function(v,i) { new_tWRD[i]==v; } )) {
				// repaint the tWRD panel
				$('#tWRDthreats').empty();
				for (const thid of new_tWRD) Threat.get(thid).addtablerow('#tWRDthreats');
			}
			if (!old_tEQT.every( function(v,i) { new_tEQT[i]==v; } )) {
				// repaint the tEQT panel
				$('#tEQTthreats').empty();
				for (const thid of new_tEQT) Threat.get(thid).addtablerow('#tEQTthreats');
			}

			p.threats = data.list;
			p.store();
			break;
		}
		
		default:
			bugreport('Unknown transaction id','Transaction.perform');
		} // end switch
	}
};


// rebuildCluster: restore one root cluster and its subclusters to its original state
//		to undo the deletion of one or more nodes.
//		It will re-create subclusters and re-add nodes to them as required, but does not
//		verify whether these nodes actually exist.
//
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
function rebuildCluster(c) {
	let cl = NodeCluster.get(c.id);
	if (!cl) {
		cl = new NodeCluster(c.type,c.id);
		cl.settitle(c.title);
		cl.setproject(c.project);
		cl.setaccordionopened(c.accordionopened);
	}
	// Try to set both parent->child and child->parent data
	let parent = NodeCluster.get(c.parent);
	if (parent) {
		parent.addchildcluster(cl.id,false);
	} else {
		cl.setparent(c.parent);
	}
	cl.childnodes = c.childnode.slice();
	cl.addthrass(c.thrass.id);
	let ta = ThreatAssessment.get(c.thrass.id);
	ta.setdescription(c.thrass.description);
	ta.setremark(c.thrass.remark);
	ta.setfreq(c.thrass.freq);
	ta.setimpact(c.thrass.impact);
	cl.childclusters = [];
	for (const cc of c.childcluster) rebuildCluster(cc);
	cl.store();
}


function transactionCompleted(str) {
	if (DEBUG)  console.log(str);
#ifdef SERVER
	autoSaveFunction();
#else
	setModified();
#endif
}


function ExportstringToArray(str) {
	let a = [];
	let patt = new RegExp(/^(.+)\n/gm);
	let r=patt.exec(str);
	while (r!=null) {
		a.push(r[1]);
		r=patt.exec(str);
	}
	return a;
}

function logdiff(s1, s2, header) {
	let a1 = ExportstringToArray(s1);
	let a2 = ExportstringToArray(s2);
	let print = false;

	a1.sort();
	a2.sort();
	let i=0, j=0;
	while (i<a1.length || j<a2.length) {
		if (i<a1.length && j<a2.length && a1[i]==a2[j]) {
			null; // do nothing
		} else {
			if (!print)  console.log("===== "+header+" =======================");
			if (i>=a1.length || a1[i]==a2[j+1]) {
				console.log("<< " + "(deleted)");
				console.log(">> " + a2[j]);
				j++;
			} else if (j>=a2.length || a1[i+1]==a2[j]) {
				console.log("<< " + a1[i]);
				console.log(">> " + "(deleted)");
				i++;
			} else {
				console.log("<< " + a1[i]);
				console.log(">> " + a2[j]);
			}

			console.log("--");
			print=true;
		}
		i++;
		j++;
	}
}

