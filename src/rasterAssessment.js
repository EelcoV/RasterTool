/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals
bugreport, _, _H, AssessmentIterator, LS, Component, NodeClusterIterator, Transaction, Vulnerability, VulnerabilityIterator, isSameString, NodeCluster, Project, H, Rules, createUUID, newRasterConfirm, nid2id, internalID, repaintCluster, reasonableString
*/

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Assessment: evaluation of a vulnerability for some component or NodeCluster
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all[]: Map of all Assessment objects, indexed by id
 *	values[]: array of possible values (single characters) for frequency and impact
 *	valueindex[]: reverse of values[].
 *	descr[]: textual description of each value-index.
 *	Clipboard[]: Clipboard for copy/pasting.
 *	combinearr[f][i]: computation table for combining frequency f and impact i.
 *	sumarr[][]:  computation table for summing two vulnerability levels.
 *	get(i): returns the object with id 'i'.
 *	combine(f,i): returns the combination of frequency f and impact i (single characters).
 *	sum(a,b): returns the sum of two vulnerability levels (single characters)
 *	worst(a,b): synonym for sum().
 * Instance properties:
 *	id: UUID
 *	vulnerability: Vulnerability-object associated with this assessment
 *	malice (getter): true iff the vulnerability is marked as malicious
 *	component: Component object to which this evaluation belongs (may be null).
 *	cluster: NodeCluster object to which this evaluation belongs (may be null).
 *	type: type of threat (type of Node to which this evaluation belongs)
 *	_title:
 *	title (getter): short name of the threat (50 chars max)
 *	description (getter): description of the threat (100 chars max)
 *	freq: frequency
 *  freqDisp: (computed&cached) adjusted frequency to display. frqDisp==freq, except for malicious vulnerabilities.
 *	impact: magnitude of effects
 *  minimpact: minimum value for impact; if less than this, highlight the field.
 *  _impactoid: object id of the impact <div> on which edit-in-place is possible.
 *	total: overall magnitude of this threat evaluation
 *	remark: free form text (200 chars max)
 *	toobject (getter): this assessments do/undo data as an object
 * Methods:
 *	destroy: destructor.
 *	setcomponent(id): set the owning Component object to id.
 *	setcluster(id): set the owning NodeCluster object to id.
 *	settitle(str): sets the short name text to 'str'.
 *	_setparentmarker(): show/hide/set the status of the Component or NodeCluster (parent).
 *	setfreq(v): sets the frequency to 'v'
 *	setimpact(v): sets the impact to 'v'
 *	setminimpact(v): (re-)format the UI element showing the impact; lowest permissible impact value is 'v'
 *  computeminimpact(): if this.cluster!=null, compute the appropriate value for minimpact, and return
 *		the list of all childnodes that have that impact.
 *	computetotal: update total based on current freq and impact, and update component and node cluster.
 *	setremark(str): sets the remark to 'str'
 *	addtablerow_textonly(prefix,interact): create the HTML code visually representing this threat assessment.
 *	addtablerow_behavioronly(prefix,interact): enable the editing-interactions for the table row.
 *	addtablerow(oid): add a HTML table row to the DOM object with id 'oid'.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var Assessment = function(type,id) {
	if (!id) {
		console.warn("*** No id specified for new Assessment");
	}
	if (id!=null && Assessment._all.has(id)) {
		bugreport("Assessment with id "+id+" already exists","Assessment.constructor");
	}
	if (type=='tACT' || type=='tUNK' || type=='tNOT') {
		bugreport("Assessment with id "+id+" has illegal type "+type,"Assessment.constructor");
	}
	this.id = (id==null ? createUUID() : id);
	this.type = type;
	this.vulnerability = null;
	this.component = null;
	this.cluster = null;
	this._title = null;
	this.freq='-';
	this.freqDisp='-';
	this.impact='-';
	this.minimpact='-';
	this._impactoid=null;
	this.total='-';
	this.remark="";
	
	this.store();
	Assessment._all.set(this.id,this);
};
Assessment.get = function(id) { return Assessment._all.get(id); };
Assessment._all = new Map();
Assessment.Clipboard = [];
Assessment.values =[
'-', // unspecified
'A', // ambiguous
'U', // extreme (ultra low)
'L', // low
'M', // medium
'H', // high
'V', // extreme (very high)
'X'  // unknown
];
Assessment.valueindex = [];
Assessment.valueindex['-']=0;
Assessment.valueindex['A']=1;
Assessment.valueindex['U']=2;
Assessment.valueindex['L']=3;
Assessment.valueindex['M']=4;
Assessment.valueindex['H']=5;
Assessment.valueindex['V']=6;
Assessment.valueindex['X']=7;
Assessment.descr = [
	_("Undetermined"),
	_("Ambiguous"),
	_("Extremely low"),
	_("Low"),
	_("Medium"),
	_("High"),
	_("Extremely high"),
	_("Unknown")
];
Assessment.wpavalueindex = [];
Assessment.wpavalueindex['A']=0;
Assessment.wpavalueindex['B']=1;
Assessment.wpavalueindex['C']=2;
Assessment.wpavalueindex['D']=3;
Assessment.wpavalueindex['E']=4;
Assessment.mdescr = [
	_("Undetermined"),
	_("Ambiguous"),
	_("Nearly impossible"),
	_("Very difficult"),
	_("Difficult"),
	_("Easy"),
	_("Trivial"),
	_("Unknown")
];
/* Combine all risk factors into a combined total score for a single threat
 * Assessment.combine[freq][impact], where
 * freq and impact = Assessment.valueindex[...]
 */
Assessment.combinearr = [
/* 			 -	 A	 U	 L	 M	 H	 V	 X */
/* '-' */ [	'-','A','-','-','-','-','-','-'],
/* 'A' */ [	'A','A','A','A','A','A','A','A'],
/* 'U' */ [	'-','A','U','U','U','U','A','X'],
/* 'L' */ [	'-','A','U','L','L','M','V','X'],
/* 'M' */ [	'-','A','U','L','M','H','V','X'],
/* 'H' */ [	'-','A','U','M','H','H','V','X'],
/* 'V' */ [	'-','A','A','V','V','V','V','X'],
/* 'X' */ [	'-','A','X','X','X','X','X','X']
];
Assessment.combine = function(a,b) {
	return Assessment.combinearr[Assessment.valueindex[a]][Assessment.valueindex[b]];
};

Assessment.ffsaw = [
/* 			 A	 B	 C	 D	 E	*/
/* '-' */ [	'-','-','-','-','-'], // undetermined
/* 'A' */ [	'A','A','A','A','A'], // ambiguous
/* 'U' */ [	'U','L','L','L','M'], // nearly impossible
/* 'L' */ [	'L','L','L','M','M'], // very difficult
/* 'M' */ [	'L','M','M','H','H'], // difficult
/* 'H' */ [	'M','H','H','H','H'], // easy
/* 'V' */ [	'H','H','H','H','V'], // trivial
/* 'X' */ [	'X','X','X','X','X']  // unknown
];
Assessment.freqFromSophisticationAndWPA = function(fr,wpa) {
	return Assessment.ffsaw[Assessment.valueindex[fr]][Assessment.wpavalueindex[wpa]];
};

/* Combine two totals into an overall vulnerability score
 * For assessment totals t0, t1, ..., tn the overall score is
 * Assessment.sum(tn, Assessment.sum(tn-1, ... (t1, t0)) ...)
 * Score = t0 (+) t1 (+) ... (+) tn
 * a (+) b == b (+) a
 * 'U' (+) x == x
 */
Assessment.sumarr = [
/* 			 -	 A	 U	 L	 M	 H	 V	 X*/
/* '-' */ [	'-','A','U','L','M','H','V','X'],
/* 'A' */ [	'A','A','A','A','A','A','V','A'],
/* 'U' */ [	'U','A','U','L','M','H','V','X'],
/* 'L' */ [	'L','A','L','L','M','H','V','X'],
/* 'M' */ [	'M','A','M','M','M','H','V','X'],
/* 'H' */ [	'H','A','H','H','H','H','V','X'],
/* 'V' */ [	'V','V','V','V','V','V','V','V'],
/* 'X' */ [	'X','A','X','X','X','X','V','X']
];
Assessment.sum = function(a,b) {
	return Assessment.sumarr[Assessment.valueindex[a]][Assessment.valueindex[b]];
};
Assessment.worst = Assessment.sum;

Assessment.autotitle = function(pid,newtitle) {
	// Non-greedy match for anything, optionally followed by space and digits between parentheses
	let targettitle, n;
	let res = newtitle.match(/^(.+?)( \((\d+)\))?$/);
	if (res[3]) {
		n = parseInt(res[3],10)+1;
		newtitle = res[1];
	} else {
		n = 0;
	}

	targettitle = newtitle;
	if (n>0)  targettitle = targettitle + ' (' + n + ')';
	// Vulnerabilitiess must be unique within the project
	while (Assessment.projecthastitle(pid,targettitle)!=-1) {
		n++;
		targettitle = newtitle + ' (' + n + ')';
	}
	return targettitle;
};

Assessment.projecthastitle= function(pid,str) {
	str = reasonableString(str);
	for (const cidobj of Component._all) {
		let cm = cidobj[1];
		if (cm.project!=pid)  continue;
		for (const ti of cm.assmnt) {
			let ta = Assessment.get(ti);
			if (isSameString(ta.title,str))  return ti;
		}
	}
	return -1;
};

Assessment.prototype = {
	destroy: function() {
		localStorage.removeItem(LS + 'A:' + this.id);
		if (Component.ThreatsComponent==this.component) {
			$('#dth'+this.id).remove();
		}
		Assessment._all.delete(this.id);
	},

	get title() {
		if (this.vulnerability) {
			let v = Vulnerability.get(this.vulnerability);
			if (!v) {
				bugreport('Vulnerability does not exist', 'Assessment.title');
			}
			return v.title;
		} else {
			return this._title;
		}
	},

	get description() {
		return (this.vulnerability ? Vulnerability.get(this.vulnerability).description : '');
	},

	get project() {
		if (this.vulnerability) {
			return Vulnerability.get(this.vulnerability).project;
		} else {
			return NodeCluster.get(this.cluster).project;
		}
	},
	
	get malice() {
		if (this.vulnerability==null) return false;
		return Vulnerability.get(this.vulnerability).malice;
	},

	setvulnerability: function(vid) {
		this.vulnerability = vid;
		this.store();
	},

	setcomponent: function(id) {
		this.component = id;
		if (this.cluster!=null) {
			bugreport("threat evaluation belongs to both a component and a NodeCluster", "Assessment.setcomponent");
		}
		this.store();
	},
	
	setcluster: function(id) {
		this.cluster = id;
		if (this.component!=null) {
			bugreport("threat evaluation belongs to both a component and a NodeCluster", "Assessment.setcluster");
		}
		this.store();
	},
	
	settitle: function(t) {
		t = reasonableString(t);
		// Silently ignore an attempt to set a blank title
		if (t=='')  return;

		if (this.component!=null) {
			// If the component already contains a threat with title "t" and the same type,
			// then silently revert to the old title.
			var cm = Component.get(this.component);
			for (const thid of cm.assmnt) {
				if (thid==this.id) continue;
				var ta = Assessment.get(thid);
				// silently ignore
				if (isSameString(ta.title,t) && ta.type==this.type)  return;
			}
//			NodeCluster.removecomponent_assessment(Project.cid,this.component,this.title,this.type,true);
			this._title = t;
//			NodeCluster.addcomponent_threat(Project.cid,this.component,this.title,this.type,false);
		} else {
			this._title = t;
		}
		this.store();
	},
	
	_setparentmarker: function() {
		if (this.component!=null) {
			Component.get(this.component).setmarker();
		}
		if (this.cluster!=null) {
			NodeCluster.get(NodeCluster.get(this.cluster).root()).setmarker();
		}
	},

	setfreq: function(v) {
		this.freq = (Assessment.values.indexOf(v)>-1 ? v : 'X');
		this.computetotal();
		this.store();
	},

	setimpact: function(v) {
		this.impact = (Assessment.values.indexOf(v)>-1 ? v : 'X');
		this.computetotal();
		this.store();
	},

	setminimpact: function(v) {
		this.minimpact = (Assessment.values.indexOf(v)>-1 ? v : 'X');
		if (this._impactoid!=null) {
			if (this.impact!='-' && Assessment.sum(this.minimpact,this.impact) != this.impact) {
				$(this._impactoid).addClass('errImpact errImpact'+this.minimpact);
			} else {
				$(this._impactoid).removeClass();
				$(this._impactoid).addClass('th_impact th_col');
			}
		}
		this.store();
	},

	computeminimpact: function() {
		if (this.cluster==null)  return null;
		var nc = NodeCluster.get(this.cluster);
		var rc = NodeCluster.get(nc.root());
		var highscore = '-';
		var highnodes = [];
		for (const cid of nc.childnodes) {
			// Find the impact for this cluster's vulnerability in the component of the node
			let cn = Node.get(cid);
			if (cn==null) {
				bugreport('cluster node does not exist','Assessment.computeminimpact');
			}
			var cm = Component.get( cn.component );
			var t;
			for (var j=0; j<cm.assmnt.length; j++) {
				t = Assessment.get(cm.assmnt[j]);
				if (isSameString(t.title,rc.title) && t.type==rc.type) break;
			}
			if (j==cm.assmnt.length) {
				bugreport("Vulnerability not found", "computeminimpact");
			}
			if (t.impact == highscore) {
				// Add to the list
				highnodes.push(cid);
			// only for 'real' impact values
			} else if ("ULMHV".indexOf(t.impact)!=-1 && Assessment.sum(highscore,t.impact) != highscore) {
				highscore = t.impact;
				highnodes = [ cid ];
			}
		}
		this.setminimpact(highscore);
		return highnodes;
	},

	computetotal: function() {
		let fr = this.freq;
		if (this.malice) {
			fr = Assessment.freqFromSophisticationAndWPA(fr,Project.get(this.project).wpa);
		}
		this.freqDisp = fr;
		this.total = Assessment.combine(fr,this.impact);
		if (this.component!=null) {
			Component.get(this.component).calculatemagnitude();
		}
		if (this.cluster!=null) {
			NodeCluster.get(NodeCluster.get(this.cluster).root()).calculatemagnitude();
		}
	},
	
	setremark: function(t) {
		this.remark = reasonableString(t);
		this.store();
	},

	addtablerow_textonly: function(prefix,interact,beforestring,afterstring) {
		if (interact==null) interact=true;
		if (beforestring==null) beforestring='<span>';
		if (afterstring==null) afterstring='</span>';
		var snippet = '<div id="dth_PF___TI_" class="threat">\
			<div id="dth__PF_mal_TI_" class="th_mal th_col">\
				<fieldset class="malset">\
					<input type="radio" id="_PF_thmal_TI_-off" name="_PF_labelthmal_TI_"><label for="_PF_thmal_TI_-off" title="_LN_"><img src="../img/natural.png" alt="_LN_"></label>\
					<input type="radio" id="_PF_thmal_TI_-on"  name="_PF_labelthmal_TI_"><label for="_PF_thmal_TI_-on" title="_LM_"><img src="../img/malice.png" alt="_LM_"></label>\
				</fieldset>\
			</div>\
			<div id="dth__PF_name_TI_" class="th_name th_col">_BS_<span id="dthE__PF_name_TI_">_TT_</span>_AS_</div>\
			<div id="dth__PF_freq_TI_" class="th_freq th_col"><span>_DF_</span></div>\
			<div id="dth__PF_impact_TI_" class="th_impact th_col"><span>_DI_</span></div>\
			<div id="dth__PF_total_TI_" class="th_total th_col">_TO_</div>\
			<div id="dth__PF_remark_TI_" class="th_remark th_col"><span>_DR_</span></div>';
		if (interact) {
			snippet += '<div class="th_del th_col" title="_DD_"><div id="dth__PF_del_TI_"></div></div>';
		}
		snippet += '</div>\n';
		snippet = snippet.replace(/_TI_/g, this.id);
		snippet = snippet.replace(/_BS_/g, beforestring);
		snippet = snippet.replace(/_AS_/g, afterstring);
		snippet = snippet.replace(/_TT_/g, H(this.title));
		snippet = snippet.replace(/_TO_/g, this.total);
		snippet = snippet.replace(/_PF_/g, prefix);
		snippet = snippet.replace(/_DF_/g, this.freqDisp);
		snippet = snippet.replace(/_DI_/g, this.impact);
		snippet = snippet.replace(/_DR_/g, H(this.remark));
		snippet = snippet.replace(/_LN_/g, _("Natural or unintentional cause"));
		snippet = snippet.replace(/_LM_/g, _("Malicious and intentional action"));
		snippet = snippet.replace(/_DD_/g, _("Remove vulnerability"));
		this._impactoid = '#dth_'+prefix+'impact'+this.id;
		return snippet;
	},
	
	addtablerow: function(oid,prefix,interact,beforestring,afterstring) {
		if (interact==null) interact=true;
		$(oid).append( this.addtablerow_textonly(prefix,interact,beforestring,afterstring) );
		this.addtablerow_behavioronly(prefix,interact);
//		$('dth_'+prefix+'del'+this.id).button({icon: 'ui-icon-trash'});
	},
	
	addtablerow_behavioronly: function(prefix,interact) {
		if (interact==null) interact=true;
		let vln = Vulnerability.get(this.vulnerability);

		if (this.component!=null && Component.get(this.component).type=='tUNK') {
			$('#dth_'+prefix+'name'+this.id).attr('title', _("For %%: ",Rules.nodetypes[this.type]) + this.description);
		} else {
			$('#dth_'+prefix+'name'+this.id).attr('title', this.description);
		}
		
		$(`#dth_${prefix}mal${this.id} input`).checkboxradio({icon: false});
		$(`#dth_${prefix}mal${this.id} fieldset`).controlgroup();
		$(`#dth_${prefix}mal${this.id} input`).eq(0).prop('checked',!this.malice);
		$(`#dth_${prefix}mal${this.id} input`).eq(1).prop('checked',this.malice);
		$(`#dth_${prefix}mal${this.id} input`).checkboxradio('option','disabled',true);
		$(`#dth_${prefix}mal${this.id} input`).checkboxradio('refresh');

		let selectoptions = '';
		for (let i=0; i<Assessment.values.length; i++) {
			if (selectoptions!='')  selectoptions += ',';
			selectoptions += '_L_ _D_:_L_';
			selectoptions = selectoptions.replace(/_L_/g, Assessment.values[i]);
			selectoptions = selectoptions.replace(/_D_/g, Assessment.descr[i]);
		}
		let assmnt = this;
		let c;

		if (this.component==null && this.cluster==null) {
			bugreport('neither .component nor .cluster is set','this.addtablerow');
		}
		if (this.component!=null) {
			c = Component.get(this.component);
		}
		var nc_isroot = false;
		if (this.cluster!=null) {
			c = NodeCluster.get(this.cluster);
			nc_isroot = c.isroot();
		}
		
		if (!nc_isroot) {
			$('#dth_'+prefix+'name'+this.id).editInPlace({
				bg_out: 'var(--vlightbg)', bg_over: 'var(--highlt)',
				callback: function(oid, enteredText) {
					if (assmnt.vulnerability==null) {
						// renaming a non-root cluster
						new Transaction('clusterTitle',
							[{id: assmnt.cluster, title: assmnt._title}],
							[{id: assmnt.cluster, title: enteredText}],
							_("Rename cluster")
						);
						return enteredText;
					}
					let it = new VulnerabilityIterator({project: vln.project, type: vln.type, title: enteredText});
					if (it.isEmpty()) {
						new Transaction('vulnDetails',
							[{vuln: vln.id, title: vln.title}],
							[{vuln: vln.id, title: enteredText}],
							_("Rename vulnerability")
						);
					} else {
						let other = it.first();
						let cm = Component.get(assmnt.component);
						let cmas_other = null;
						for (const aid of cm.assmnt) {
							let a = Assessment.get(aid);
							if (a.vulnerability==other.id) cmas_other = a;
						}
						// Skip renaming if the new vulnerability already exists on an assessment for this component
						if (cmas_other==null) {
							// Chain iff the old vulnerability is unused after the swap *and* is custom.
							// That happens when it is only used once (namely on this component).
							let vlnit = new AssessmentIterator({vuln: vln.id, ofcomponent: true});
							let chain = (vlnit.count()==1 && !vln.common);
							let actiondescr = _("Remove vulnerability '%%'",vln.title);
							new Transaction('assessmentDetails',
								[{assmnt: assmnt.id, vuln: vln.id}],
								[{assmnt: assmnt.id, vuln: other.id}],
								actiondescr,chain);
							if (chain) {
								let p = Project.get(vln.project);
								let it = new NodeClusterIterator({project: p.id, isroot: true, type: vln.type, title: vln.title});
								if (it.count()!=1) {
									bugreport("No or too many node clusters","Assessment rename callback");
								}
								let cl = it.first();
								let do_data = {create: false, id: vln.id};
								let undo_data = {create: true, id: vln.id, project: p.id, type: vln.type, title: vln.title, description: vln.description,
									common: false, cluster: cl.id, cla: cl.assmnt
								};
								new Transaction('vulnCreateDelete', [undo_data], [do_data], actiondescr);
							}
						}
					}
					return H(vln.title);
				},
				delegate: {
					didCloseEditInPlace: function(aDOMNode) {
						// When closing the editor without changing anything, the linedrawing images in front of the subcluster need to be repainted.
						// We simply repaint the entire rootcluster.
						// This is only necessary for assessments of subclusters, therefore .vulnerability must be null.
						if (assmnt.vulnerability!=null) return;
						let id = internalID(aDOMNode[0].id);
						let nc = NodeCluster.get(id);
						repaintCluster(nc.root());
					}
				}
			});
		}
		$('#dth_'+prefix+'freq'+this.id).editInPlace({
			bg_out: 'var(--vlightbg)', bg_over: 'var(--highlt)',
			field_type: 'select',
			select_options: selectoptions,
			select_text: _("Frequency"),
			callback: function(oid, enteredText) {
				new Transaction('assessmentDetails',
					[{assmnt: assmnt.id, freq: assmnt.freq}],
					[{assmnt: assmnt.id, freq: enteredText}],
					_("Edit frequency")
				);
				return assmnt.freqDisp;
			},
			delegate: {
				shouldOpenEditInPlace: function(dom,settings) {
					if (assmnt.malice) {
						// When malicious, we display the adjust frequency. Quickly swap the stored .freq value
						// into place just before openening the select.
						dom.text(assmnt.freq);
						// And also change the select options, as the current project.wpa may have changed
						let wpa = Project.get(assmnt.project).wpa;
						let fselectoptions='';
						for (let i=0; i<Assessment.values.length; i++) {
							if (fselectoptions!='')  fselectoptions += ',';
							fselectoptions += '_T_ _D_:_L_';
							fselectoptions = fselectoptions.replace(/_T_/g, Assessment.freqFromSophisticationAndWPA(Assessment.values[i],wpa));
							fselectoptions = fselectoptions.replace(/_D_/g, Assessment.mdescr[i]);
							fselectoptions = fselectoptions.replace(/_L_/g, Assessment.values[i]);
						}
						settings.select_options = fselectoptions;
						settings.select_text = _("Difficulty");
					} else {
						settings.selectoptions = selectoptions;
						settings.selecttext = _("Frequency");
					}
					return true;
				},
				didCloseEditInPlace: function(dom) {
					// When malicious, we restore the display freqeuncy. There is a Transaction coming after
					// this, so this is only useful in case there is no change.
					dom.text(assmnt.freqDisp);
				}
			}
		});

		this.computeminimpact(); // Ignore return value
		$('#dth_'+prefix+'impact'+this.id).editInPlace({
			bg_out: 'var(--vlightbg)', bg_over: 'var(--highlt)',
			field_type: 'select',
			select_options: selectoptions,
			select_text: _("Impact:"),
			preinit: function() {
				// Add a hint: the impact probably should be at least that of the highest impact of its member nodes.
				var highnodes = assmnt.computeminimpact();

				$(this).addClass('th_impact th_col');
				// Only warn of the impact should be at least Medium
				if ("MHV".indexOf(assmnt.minimpact)==-1)  return;

				var str;
				str  = _H("The impact should be at least %%, because the following nodes have that impact for single failures.",
					Assessment.descr[Assessment.valueindex[assmnt.minimpact]] );
				str += '<br><ul>\n';

				for (var j=0; j<highnodes.length; j++) {
					var n = Node.get(highnodes[j]);
					str += '<li>' + n.htmltitle() + '</li>\n';
				}
				str += '</ul>';
				$('#impacthint').html(str);
				$('#outerimpacthint').show();

				let point_offset_top = $(this).offset().top-10; // 10 means half the point, so the tip will be at the impact
				let point_css_top = point_offset_top - $('#outerimpacthint').offset().top;
				let hint_css_top = parseInt($('#outerimpacthint').css('top'),10);
				// to fix the point on the screen keep point_css_top+hint_css_top invariant
				if (point_css_top<10) {
					hint_css_top -= 10-point_css_top;
					point_css_top = 10;
				}
				if (point_css_top>250) {
					hint_css_top += point_css_top-250;
					point_css_top = 250;
				}
				$('#hintpoint').animate({top: point_css_top});
				$('#outerimpacthint').animate({top: hint_css_top});
			},
			postclose: function() {
				$('#outerimpacthint').hide();	// When editing impact of CCFs
			},
			callback: function(oid, enteredText) {
				new Transaction('assessmentDetails',
					[{assmnt: assmnt.id, impact: assmnt.impact}],
					[{assmnt: assmnt.id, impact: enteredText}],
					_("Edit impact")
				);
				return '<span>'+enteredText+'</span>';
			}
		});

		$('#dth_'+prefix+'remark'+this.id).editInPlace({
			bg_out: 'var(--vlightbg)', bg_over: 'var(--highlt)',
			default_text: '-',
			callback: function(oid, enteredText) {
				new Transaction('assessmentDetails',
					[{assmnt: assmnt.id, remark: assmnt.remark}],
					[{assmnt: assmnt.id, remark: enteredText}],
					_("Edit remark")
				);
				return H(assmnt.remark);
			}
		});
	
		if (interact) {
			$(`#dth_${prefix}mal${this.id} input`).checkboxradio('option','disabled',false);
			$(`#dth_${prefix}mal${this.id} input`).on('change', function() {
				let val = $(`#dth_${prefix}mal${assmnt.id} input`).eq(1).prop('checked');
				new Transaction('vulnDetails',
					[{vuln: vln.id, malice: vln.malice}],
					[{vuln: vln.id, malice: val}],
					_("Change cause type of vulnerability")
				);

			});
			$('#dth_'+prefix+"del"+this.id).button({label: '⊗'}).on('click',  function() {
				let assmnt = Assessment.get(nid2id(this.id));
				let cm;
				if (assmnt.component!=null) {
					cm = Component.get(assmnt.component);
				} else {
					bugreport("Was expecting a Component","Assessment.addtablerow");
				}
				var idx = cm.assmnt.indexOf(assmnt.id);
				var dokill = function() {
					// Locate the corresponding cluster in the project.
					// There should be exactly one.
					let it = new NodeClusterIterator({project: c.project, isroot: true, type: assmnt.type, title: assmnt.title});
					let nc = it.first();
					let vln = Vulnerability.get(assmnt.vulnerability);
					it = new AssessmentIterator({vuln: vln.id, ofcomponent: true});
					let chain = false;
					if (!vln.common && it.count()==1) chain = true;  // Deleting the last assessment for a custom vulnerability
					let actiondescr = _("Remove vulnerability '%%'",assmnt.title);
					new Transaction('assmCreateDelete',[{
						  create: true,
						  vuln: assmnt.vulnerability,
						  assmnt: [{
							  id: assmnt.id,
							  component: cm.id,
							  index: idx,
							  remark: assmnt.remark,
							  freq: assmnt.freq,
							  impact: assmnt.impact
						    }],
						  clid: nc.id,
						  cluster: nc.structure()
						}],[{
						  create: false,
						  vuln: assmnt.vulnerability,
						  assmnt: [{
							  id: assmnt.id
						    }],
						  clid: nc.id
						}],
						actiondescr,
						chain
					);
					if (chain) {
						// Also delete the custom vulnerability
						new Transaction('vulnCreateDelete',[{
							create: true, id: vln.id,
							project: vln.project, type: vln.type, title: vln.title, description: vln.description,
							common: false, cluster: nc.id, cla: nc.assmnt
						}],[{
							create: false, id: vln.id
						}],actiondescr);
					}
				};
				newRasterConfirm(_("Delete vulnerability?"),
					_H("Vulnerabilities should only be deleted when physically impossible.")+
					'<br>\n'+
					_H("Are you sure that '%%' for '%%' is nonsensical?", assmnt.title,cm.title),
					_("It's impossible"),_("Cancel")
				).done(dokill);
			});
		}
	},

	get toobject() {
		let it = new NodeClusterIterator({project: this.project, isroot: true, type: this.type, title: this.title});
		let nc = it.first();
		return {
			id: this.id,
			type: this.type,
			vulnerability: this.vulnerability,
			common: (this.vulnerability!=null && Vulnerability.get(this.vulnerability).common),
			clid: nc==null?null:nc.id,		// nc being null is a bug, but this helps in recovery
			cla: nc==null?null:nc.assmnt,
			project: this.project,
			title: this.title,
			description: this.description,
			freq: this.freq,
			impact: this.impact,
			remark: this.remark
		};
	},

	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.v=this.vulnerability;
		data.m=this.component;
		data.u=this.cluster;
		data.l=this._title;
		data.p=this.freq;
		data.i=this.impact;
		// this.minimpact does not need to be stored, but is recomputed.
		data.r=this.remark;
		return JSON.stringify(data);
	},
	
	exportstring: function() {
		var key = LS+'A:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},
	
	store: function() {
		var key = LS+'A:'+this.id;
		localStorage[key] = this._stringify();
	}
};

