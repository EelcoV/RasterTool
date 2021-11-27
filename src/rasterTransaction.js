/* Copyright (C) Eelco Vriezekolk, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals _, refreshComponentThreatAssessmentsDialog, AssessmentIterator, Component, DEBUG, H, NodeCluster, NodeClusterIterator, Project, RefreshNodeReportDialog, Service, Vulnerability, Assessment, VulnerabilityIterator, autoSaveFunction, bugreport, checkForErrors, exportProject, nid2id, refreshChecklistsDialog, repaintCluster
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
			//	title, type, project, parent, nodes, assmnt: properties of the new cluster
			// or
			//	move: list of node ids
			//	to: id of node cluster to move these nodes into
			for (const d of data) {
				if (d.structure!=null) {
					rebuildCluster(d.structure);
					repaintCluster(d.root);
					if (d.destroy) NodeCluster.get(d.destroy).destroy();
				} else if (d.remove!=null) {
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
				} else if (d.move_from!=null) {
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
					nc.addassessment(d.assmnt);
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
				$('#dthE_ccf'+nc.root()+'name'+nc.assmnt).html(H(nc.title));
				$('#litext'+nc.id).html(H(nc.title));
			}
			break;
		}

		case 'compAssessments': {
			// Change the order of assessments
			// data: array of objects; each object has these properties
			//  id: id of the component
			//  assmnt: list of ids of the assessments of the component
			for (const d of data) {
				let c = Component.get(d.id);
				c.assmnt = d.assmnt;
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
			//   assmnt: array of objects containing info on the vulnerabilities:
			//     id, type, vulnerability, title, description, freq, impact, remark: as of the assessment
			//   accordionopened: state of the component in Single Failures view
			//   single: id of the representing node iff single, or false iff not single
			//  cluster: an array of objects with the following properties (may be absent only if creating tACT or tNOT)
			//    id: ID of the cluster object
			//    title: title of the cluster
			//    project: project to which this cluster belongs
			//    parent: ID of the parent cluster (null, if root cluster)
			//    assmnt: object containing info on the assessment for the cluster (as see above)
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
					for (const t of d.assmnt) {
						let ta = new Assessment(t.type, t.id);
						let vln = Vulnerability.get(t.vulnerability);
						if (vln==null) {
							vln = new Vulnerability(t.project,t.type,t.vulnerability);
							vln.settitle(t.title);
							vln.setdescription(t.description);
							vln.setcommon(t.common);
							let nc = new NodeCluster(t.type,t.clid);
							nc.setproject(t.project);
							nc.settitle(t.title);
							nc.addassessment(t.cla);
							Assessment.get(t.cla).setvulnerability(t.vulnerability);
						}
						ta.setvulnerability(t.vulnerability);
						ta.setremark(t.remark);
						ta.setfreq(t.freq);
						ta.setimpact(t.impact);
						cm.addassessment(ta);
					}
					cm.accordionopened = d.accordionopened;
					cm.title = d.title;
				}
				cm.single = (d.single ? d.single!=false : false);
				cm.addnode(d.id, (d.id==d.single));
				cm.repaintmembertitles();
			}
			// Delete any custom vulnerabilities (and their root clusters) that do not have any assessments anymore
			// We don't know the project, but it is safe to iterate over all projects.
			let vit = new VulnerabilityIterator({common: false});
			for (const vln of vit) {
				let ait = new AssessmentIterator({vuln: vln.id, ofcomponent: true});
				if (ait.isEmpty()) {
					let it = new NodeClusterIterator({project: vln.project, isroot: true, type: vln.type, title: vln.title});
					if (it.count()!=1) {
						bugreport(_("weird number of node clusters"),"Transaction.nodeCreateDelete");
						break;
					}
					let nc = it.first();
					nc.destroy();
					vln.destroy();
				}
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

			data.clusters.forEach(d => rebuildCluster(d));
			let it = new NodeClusterIterator({project: Project.cid, isroot: true});
			it.forEach(cl => repaintCluster(cl.id));
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
			//  assmnt: array of assessments when the component needs to be created
			//		id, vulnerability, title, description, freq, impact, remark of the assessment
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
						for (const t of d.assmnt) {
							let ta = new Assessment(t.type, t.id);
							let vln = Vulnerability.get(t.vulnerability);
							if (vln==null) {
								vln = new Vulnerability(t.project,t.type,t.vulnerability);
								vln.settitle(t.title);
								vln.setdescription(t.description);
								vln.setcommon(t.common);
								let nc = new NodeCluster(t.type,t.clid);
								nc.setproject(t.project);
								nc.settitle(t.title);
								nc.addassessment(t.cla);
								Assessment.get(t.cla).setvulnerability(t.vulnerability);
							}
							ta.setvulnerability(t.vulnerability);
							ta.setremark(t.remark);
							ta.setfreq(t.freq);
							ta.setimpact(t.impact);
							cm.addassessment(ta);
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
				for (const thid of cm.assmnt) {
					let ta = Assessment.get(thid);
					let it = new NodeClusterIterator({project: cm.project, title: ta.title, type: ta.type});
					it.forEach(nc => repaintCluster(nc.id));
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
					p.removeservice(d.id); // will unload and destroy the service
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
			$('#bottomtabsdiagrams').empty();
			$('#bottomtabssinglefs').empty();
			data.list.forEach( sid => {
				let s = Service.get(sid);
				s.inserttab('diagrams');
				s.inserttab('singlefs');
			});
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

		case 'assessmentCreateDelete': {
			// Create or remove a assessment from a component
			// data: an object with these properties
			//  create: true when adding, false when removing an assessment
			//	vuln: ID of vulnerability for this assessment (iff create)
			//	assmnt[]: array of objects containing these properties:
			//    id: ID of the Assessment to create or delete
			//	  component: component for the assessment (iff create)
			//	  freq: frequency-value of the assessment (iff create)
			//	  impact: impact-value of the assessment (iff create)
			//	  remark: remark of the assessment (iff create)
			//    index: position of the assessment within the component (iff create)
			//  clid: id of the root cluster for this vulnerability
			//  cluster: object describing the cluster, its subclusters, childnodes etc. Used on undo, see nodeCreateDelete. (iff create)
			let vln = Vulnerability.get(data.vuln);
			let nc = NodeCluster.get(data.clid);
			if (data.create) {
				// Create/add
				for (const aa of data.assmnt) {
					let assmnt = new Assessment(vln.type,aa.id);
					let cm = Component.get(aa.component);
					if (aa.freq!=null)  assmnt.setfreq(aa.freq);
					if (aa.impact!=null)  assmnt.setimpact(aa.impact);
					if (aa.remark!=null)  assmnt.setremark(aa.remark);
					assmnt.setvulnerability(vln.id);
					cm.addassessment(assmnt,aa.index);
					cm.setmarker();
					cm.repaint();
				}
				if (data.cluster) rebuildCluster(data.cluster);
			} else {
				// Delete/remove
				for (const aa of data.assmnt) {
					let assmnt = Assessment.get(aa.id);
					if (!assmnt) {
						bugreport('No such assessment','Transaction.assessmentCreateDelete');
					}
					let cm = Component.get(assmnt.component);
					cm.removeassessment(assmnt.id); // will destroy assmnt
					for (let i=0; i< (cm.single?1:cm.nodes.length); i++) {
						nc.removechildnode(cm.nodes[i]);
					}
					nc.normalize();
					$('#dthdia'+'_'+assmnt.id).remove();
					$('#dthsfa'+'_'+assmnt.id).remove();
					cm.setmarker();
					cm.repaint();
				}
				repaintCluster(nc.id);
			}
			break;
		}

		case 'assessmentDetails': {
			// Change the details of a Assessment
			// data: array of objects; each object has these properties
			//	assmnt: id of the Assessment
			//	vuln: vulnerability of the assessment
			//	freq: frequency-value of the assessment
			//	impact: impact-value of the assessment
			//	remark: remark of the assessment
			//  component, cluster: (either/or) the object to which this assessment belongs
			for (const d of data) {
				let a = Assessment.get(d.assmnt);
				let prevvuln = a.vulnerability;
				if (d.vuln!=null)  a.setvulnerability(d.vuln);
				if (d.remark!=null)  a.setremark(d.remark);
				if (d.freq!=null)  a.setfreq(d.freq);
				if (d.impact!=null)  a.setimpact(d.impact);
				if (a.cluster) {
					repaintCluster(NodeCluster.get(a.cluster).root());
				} else {
					let cm = Component.get(a.component);
					cm.repaint();
					if (a.vulnerability!=prevvuln) {
						let oldvuln = Vulnerability.get(prevvuln);
						let newvuln = Vulnerability.get(a.vulnerability);
						let oit = new NodeClusterIterator({project: oldvuln.project, type: oldvuln.type, title: oldvuln.title, isroot: true});
						let nit = new NodeClusterIterator({project: newvuln.project, type: newvuln.type, title: newvuln.title, isroot: true});
						if (oit.count()!=1 || nit.count()!=1)  bugreport('No unique root clusters','Transaction.assessmentDetails');
						let onc = oit.first();
						let nnc = nit.first();
						for (const nid of cm.nodes) onc.removechildnode(nid);
						for (const nid of cm.nodes) nnc.addchildnode(nid);
						repaintCluster(onc.id);
						repaintCluster(nnc.id);
					}
				}
			}
			break;
		}

		case 'vulnCreateDelete': {
			// Add or remove a Vulnerability (but not any assessments of that Vulnerability)
			// When deleting, there should not be any Assessments for this Vulnerability! The node clusters
			// will should be empty, and will be deleted as well
			// data: a sigle object with these properties
			//  create: true when adding, false when removing threat(assessment)
			//	id: ID of the Vulnerability
			//	project: project ID of the Vulnerability (iff create)
			//	type: type of the Vulnerability (iff create)
			//	title: title of the Vulnerability (iff create)
			//	description: description of the Vulnerability (iff create)
			//	common: whether or not this Vulnerability is default for the project (iff create)
			//  cluster: ID of the root cluster for this Vulnerability (iff create)
			//  cla: ID of the Assessment of the cluster (iff create)
			//	index: position of the Vulnerability within the project (iff create and common==true)
			if (data.create) {
				// Add a vulnerability
				let vln = new Vulnerability(data.project,data.type,data.id);
				if (data.title!=null) vln.settitle(data.title);
				if (data.description!=null) vln.setdescription(data.description);
				if (data.common!=null) vln.setcommon(data.common);
				if (data.common) {
					let p = Project.get(data.project);
					p.addvulnerability(data.id,data.cluster,data.cla,data.index);
				} else {
					let nc = new NodeCluster(data.type,data.cluster);
					nc.setproject(data.project);
					nc.settitle(data.title);
					nc.addassessment(data.cla);
					Assessment.get(data.cla).setvulnerability(data.id);
				}
			} else {
				// Remove a vulnerability and its (emtpy) root cluster
				let it = new AssessmentIterator({vuln: data.id, ofcomponent: true});
				if (it.count()>0) {
					bugreport(_("vulnerability still has assessments"),"Transaction.vulnCreateDelete");
					break;
				}
				let vln = Vulnerability.get(data.id);
				let p = Project.get(vln.project);
				it = new NodeClusterIterator({project: vln.project, isroot: true, type: vln.type, title: vln.title});
				if (it.count()!=1) {
					bugreport(_("weird number of node clusters"),"Transaction.vulnCreateDelete");
					break;
				}
				let nc = it.first();
				nc.destroy();
				if (vln.common) {
					p.removevulnerability(vln.id);
				}
				vln.destroy();
			}
			refreshChecklistsDialog(data.type);
			break;
		}

		case 'vulnDetails': {
			// Global edit of title and description of vulnerabilities and node templates
			// data: array of objects; each object has these properties
			//	vuln: ID of the Vulnerability to chage
			//	title: new title (may be null, indicating no change)
			//	description: new description (may be null, indicating no change)
			for (const d of data) {
				let vln = Vulnerability.get(d.vuln);
				if (d.description!=null)  vln.setdescription(d.description);
				if (d.title!=null) {
					let it = new NodeClusterIterator({project: vln.project, type: vln.type, title: vln.title});
					if (it.count()!=1) {
						bugreport(_("weird number of node clusters"),"Transaction.vulnCreateDelete");
					}
					let nc = it.first();
					vln.settitle(d.title);
					nc.settitle(d.title);
				}
				refreshChecklistsDialog(vln.type);
				refreshComponentThreatAssessmentsDialog();
				// Repaint each component in which this vulnerability appears
				let it = new AssessmentIterator({vuln: d.vuln});
				for (const a of it) {
					if (!a.component) continue;
					Component.get(a.component).repaint();
				}
			}
			break;
		}

		case 'vulnsReorder': {
			// Global change in the order of common vulnerabilities
			// data: a single object containing these fields:
			//	project: the id of the project
			//	list: the re-ordered list of vulnerabilities
			// No vulnerabilities will or should be added or removed in this transaction.
			let p = Project.get(data.project);
			// Compile arrays before and after move. With this information we can repaint
			// only the threat panel that was modified, and we avoid repainting the ones that
			// did not change.
			let old_tWLS=[], old_tWRD=[], old_tEQT=[];
			for (const vid of p.vulns) {
				let vln = Vulnerability.get(vid);
				switch (vln.type) {
					case 'tWLS': old_tWLS.push(vid); break;
					case 'tWRD': old_tWRD.push(vid); break;
					case 'tEQT': old_tEQT.push(vid); break;
				}
			}
			let new_tWLS=[], new_tWRD=[], new_tEQT=[];
			for (const vid of data.list) {
				let vln = Vulnerability.get(vid);
				if (!vln) {
					bugreport('unknown vulnerability', 'Transaction.vulnsReorder');
					return;
				}
				switch (vln.type) {
					case 'tWLS': new_tWLS.push(vid); break;
					case 'tWRD': new_tWRD.push(vid); break;
					case 'tEQT': new_tEQT.push(vid); break;
				}
			}
			// if arrays old_tWLS and new_tWLS are not equal
			if (!old_tWLS.every( (v,i) => new_tWLS[i]==v )) {
				// repaint the tWLS panel
				$('#tWLSthreats').empty();
				for (const vid of new_tWLS) Vulnerability.get(vid).addtablerow('#tWLSthreats');
			}
			if (!old_tWRD.every( (v,i) => new_tWRD[i]==v )) {
				// repaint the tWRD panel
				$('#tWRDthreats').empty();
				for (const vid of new_tWRD) Vulnerability.get(vid).addtablerow('#tWRDthreats');
			}
			if (!old_tEQT.every( (v,i) => new_tEQT[i]==v )) {
				// repaint the tEQT panel
				$('#tEQTthreats').empty();
				for (const vid of new_tEQT) Vulnerability.get(vid).addtablerow('#tEQTthreats');
			}

			p.vulns = data.list;
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
// assmnt: object containing info on the cluster's vulnerability assessment
//   id, type, vulnerability, title, description, freq, impact, remark: as of the assessment
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
	cl.addassessment(c.assmnt.id);
	let ta = Assessment.get(c.assmnt.id);
	if (c.assmnt.vulnerability) {
		ta.setvulnerability(c.assmnt.vulnerability);
	} else if (!cl.isroot()) {
		// Set only for non-root clusters (root clusters inherit from the common Vulnerability
		ta.settitle(c.assmnt.title);
	}
	ta.setremark(c.assmnt.remark);
	ta.setfreq(c.assmnt.freq);
	ta.setimpact(c.assmnt.impact);
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

