/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
	isSameString, Assessment, Component, NodeCluster, Project, Service, Vulnerability
*/


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * rasterIterator: base class for all raster object iterators; must be subclassed
 *
 * intended usage:
 * 		var it = new «ObjectIterator»({options...});
 *		it.sortByType();
 * 		for (const obj of it) {
 *			console.log(obj.id);
 *	 		:
 *		}
 *
 * Methods:
 *	isEmpty(): boolean, true iff no matches were found
 *	count(): integer, returns the number of matches
 *	first(): object, returns the first matching object
 *	some(f): boolean, returns true iff there exists a match such that f(match)==true
 *	every(f): boolean, returns true iff for all matches f(match)==true
 *	forEach(f): no return value, executes f(match) for all items of the iterator
 *
 *	sortByTitle(): no return value, sorts the matches by their .title property (case-insensitive, locale-sensitive)
 *	sortByType(): no return value, sorts the matches by their .type property.
 *	sortByLevel: no return value, sorts the matches by their .magnitude, then by their .title
 */
class rasterIterator {
	constructor() {
		this.item = [];
	}

	*[Symbol.iterator]() {
		for (const id of this.item) {
			yield id;
		}
	}

	isEmpty() {
		return this.item.length==0;
	}
	count() {
		return this.item.length;
	}
	first() {
		return this.item[0];
	}
	some(func) {
		for (const v of this.item) {
			if (func(v)) return true;
		}
		return false;
	}
	every(func) {
		for (const v of this.item) {
			if (!func(v)) return false;
		}
		return true;
	}
	forEach(func) {
		for (const v of this.item) func(v);
	}
	sortByTitle() {
		this.item.sort( function(ta,tb) {
			return ta.title.toLocaleLowerCase().localeCompare(tb.title.toLocaleLowerCase());
		});
	}
	sortByType() {
		this.item.sort( function(ta,tb) {
			if (ta.type<tb.type)  return -1;
			if (ta.type>tb.type)  return 1;
			return 0;
		});
	}
	sortByLevel() {
		this.item.sort( function(na,nb) {
			let va = Assessment.valueindex[na.magnitude];
			let vb = Assessment.valueindex[nb.magnitude];
			if (va==1) va=8; // Ambiguous
			if (vb==1) vb=8;
			if (va!=vb)  return vb - va;
			// When levels are equal, sort alphabetically
			return na.title.toLocaleLowerCase().localeCompare(nb.title.toLocaleLowerCase());
		});
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * AssessmentIterator: iterate over certain assessments
 *
 * Options:
 *	project: project id equals value
 *	type: type equals value
 *	match: type matches value (equal to value OR value equals 'tUNK')
 *	title: title string equals value (case insensitive and locale sensitive)
 *	vuln: vulnerability id equals value
 *	ofcomponent: (boolean) whether or not this assessment belongs to a component
 */
class AssessmentIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		for (const i in Assessment._all) {
			let obj = Assessment.get(i);
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			if (opt.type!=undefined && opt.type!=obj.type)  continue;
			if (opt.match!=undefined && opt.match!=obj.type && opt.match!='tUNK')  continue;
			if (opt.title!=undefined && !isSameString(obj.title,opt.title))  continue;
			if (opt.vuln!=undefined && opt.vuln!=obj.vulnerability)  continue;
			if (opt.ofcomponent!=undefined && opt.ofcomponent!=(obj.component!=null))  continue;
			this.item.push(obj);
		}
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * ComponentIterator: iterate over certain components
 *
 * Options:
 *	project: project id equals value
 *	type: type equals value
 *	match: type matches value (equal to value OR value equals 'tUNK')
 *	service: for any nodes of this service their .service equals value
 */
class ComponentIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		for (const i in Component._all) {
			var obj =  Component._all[i];
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			if (opt.type!=undefined && opt.type!=obj.type)  continue;
			// Note that this line is different, as Components can have type 'tUNK' themselves.
			if (opt.match!=undefined && opt.match!=obj.type && opt.match!='tUNK' && obj.type!='tUNK')  continue;
			if (opt.service!=undefined) {
				let occurs=false;
				for (let j=0; !occurs && j<obj.nodes.length; j++) {
					occurs = (Node.get(obj.nodes[j]).service==opt.service);
				}
				if (!occurs) continue;
			}
			this.item.push(obj);
		}
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * NodeIterator: iterate over all Node objects
 *
 * opt: object with options to restrict the iteration to specified items only.
 *		Specify project (ID), service (ID), type (string), and/or match (string).
 * Option 'match' is similar to 'type'; 'type' looks for equality, but 'match'
 * looks for either equality or a cloud-type.
 *
 *	project: project id equals value
 *	type: type equals value
 *	service: service id equals value
 *	match: type matches value (equal to value OR equal to 'tUNK' OR (value equals 'tUNK' and node is not Actor nor Note))
 *
 *	sortByTitle(): no return value, sorts the matches by their title+suffix property (case-insensitive, locale-sensitive)
 *	sortByType(): no return value, sorts the matches by their .type property. Within types, sort by title+suffix.
 *	sortByLevel: no return value, sorts the matches by the magnitude of their component, then by their title+suffix's
 */
class NodeIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		for (const i in Node._all) {
			var obj = Node._all[i];
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			if (opt.type!=undefined && opt.type!=obj.type)  continue;
			if (opt.service!=undefined && opt.service!=obj.service)  continue;
			if (opt.match!=undefined &&
				!(obj.type==opt.match
					|| obj.type=='tUNK'
					|| (obj.type!='tACT' && obj.type!='tNOT' && 'tUNK'==opt.match)
				)
			) continue;
			this.item.push(obj);
		}
	}
	sortByName() {
		this.item.sort( function(na,nb) {
			const ta = na.title+na.suffix;
			const tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	}
	sortByType() {
		this.item.sort( function(na,nb) {
			if (na.type<nb.type)  return -1;
			if (na.type>nb.type)  return 1;
			// When types are equal, sort alphabetically
			const ta = na.title+na.suffix;
			const tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	}
	sortByLevel() {
		this.item.sort( function(na,nb) {
			const ca = Component.get(na.component);
			const cb = Component.get(nb.component);
			let va = Assessment.valueindex[ca.magnitude];
			let vb = Assessment.valueindex[cb.magnitude];
			if (va==1)  va=8; // Ambiguous
			if (vb==1)  vb=8;
			if (va!=vb)  return vb - va;
			// When levels are equal, sort alphabetically
			const ta = na.title+na.suffix;
			const tb = nb.title+nb.suffix;
			return ta.toLocaleLowerCase().localeCompare(tb.toLocaleLowerCase());
		});
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * NodeClusterIterator: iterate over certain NodeClusters
 *
 * Options:
 *	project: project id equals value
 *	type: type equals value
 *	match: type matches value (equal to value OR value equals 'tUNK')
 *	title: title string equals value (case insensitive and locale sensitive)
 *	parentcluster: cluster id matches value
 *	isroot: (boolean) whether or not this cluster is a root cluster
 *	isstub: (boolean) whether or not this cluster is a stub (less than two child nodes and child clusters)
 *  isempty: (boolean) whether or not this cluster is empty (no child nodes nor child clusters)
 */
class NodeClusterIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		for (const i in NodeCluster._all) {
			var obj = NodeCluster._all[i];
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			if (opt.type!=undefined && opt.type!=obj.type)  continue;
			if (opt.match!=undefined && opt.match!=obj.type && opt.match!='tUNK')  continue;
			if (opt.title!=undefined && !isSameString(obj.title,opt.title))  continue;
			if (opt.parentcluster!=undefined && opt.parentcluster!=obj.parentcluster) continue;
			if (opt.isroot!=undefined && opt.isroot!=obj.isroot()) continue;
			if (opt.isstub!=undefined && opt.isstub!=(obj.childnodes.length+obj.childclusters.length<2)) continue;
			if (opt.isempty!=undefined && opt.isempty!=(obj.childnodes.length+obj.childclusters.length==0)) continue;
			this.item.push(obj);
		}
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * ProjectIterator: iterate over certain projects
 *
 * Options:
 *	title: title matches string
 *	group: group matches string
 *	shared: project's shared (boolean) equals value
 *	stub: project's stub (boolean) equals value. Default: false, only non-stubs!
 */
class ProjectIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		if (opt.stub==null) opt.stub=false;
		for (const i in Project._all) {
			let obj =  Project._all[i];
			if (opt.title!=undefined && !isSameString(obj.title,opt.title))  continue;
			if (opt.group!=undefined && obj.group!=opt.group)  continue;
			if (opt.shared!=undefined && opt.shared!=obj.shared) continue;
			if (opt.stub!=obj.stub) continue;
			this.item.push(obj);
		}
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * ServiceIterator: iterate over all services of a project
 *
 * Options:
 *	project: project id equals value
 */
class ServiceIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		for (const i in Service._all) {
			let obj = Service.get(i);
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			this.item.push(obj);
		}
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * VulnerabilityIterator: iterate over certain vulnerabilities
 *
 * Options:
 *	project: project id equals value
 *	type: type equals value
 *	match: type matches value (equal to value OR value equals 'tUNK')
 *	title: title string equals value (case insensitive and locale sensitive)
 *	common: common equals value
 */
class VulnerabilityIterator extends rasterIterator {		// eslint-disable-line no-unused-vars
	constructor(opt) {
		super();
		if (opt==null) opt={};
		for (const i in Vulnerability._all) {
			let obj = Vulnerability.get(i);
			if (opt.project!=undefined && opt.project!=obj.project)  continue;
			if (opt.type!=undefined && opt.type!=obj.type)  continue;
			if (opt.match!=undefined && opt.match!=obj.type && opt.match!='tUNK')  continue;
			if (opt.title!=undefined && !isSameString(obj.title,opt.title))  continue;
			if (opt.common!=undefined && obj.common!=opt.common)  continue;
			this.item.push(obj);
		}
	}
}

