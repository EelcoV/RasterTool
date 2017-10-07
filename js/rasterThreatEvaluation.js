/* Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
 * See LICENSE.md
 */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * ThreatAssessment: evaluation of a threat for some component or NodeCluster
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all[]: all ThreatAssessment objects, indexed by id
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
 *	type: one of 'tWLS','tWRD','tEQT','tACT','tUNK'
 *	id: unique number
 *	component: Component object to which this evaluation belongs (may be null).
 *	cluster: NodeCluster object to which this evaluation belongs (may be null).
 *	type: type of threat (type of Node to which this evaluation belongs)
 *	title: short name of the threat (50 chars max)
 *	description: description of the threat (100 chars max)
 *	freq: frequency
 *	impact: magnitude of effects
 *	total: overall magnitude of this threat evaluation
 *	remark: free form text (200 chars max)
 * Methods:
 *	destroy: destructor.
 *	_isblank(): returns whether the eval is in its initial (unmodified) state.
 *	setcomponent(id): set the owning Component object to id.
 *	setcluster(id): set the owning NodeCluster object to id.
 *	settitle(str): sets the short name text to 'str'.
 *	_setparentmarker(): show/hide/set the status of the Component or NodeCluster (parent).
 *	setdescription(str): sets the full description text to 'str'.
 *	setfreq(v): sets the frequency to 'v'
 *	setimpact(v): sets the impact to 'v'
 *	computetotal: update total based on current freq and impact, and update component and node cluster.
 *	setremark(str): sets the remark to 'str'
 *	addtablerow_textonly(prefix,interact): create the HTML code visually representing this threat assessment.
 *	addtablerow_behavioronly(oid,prefix,interact): enable the editing-interactions for the table row.
 *	addtablerow(oid): add a HTML table row to the DOM object with id 'oid'.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var ThreatAssessment = function(type,id) {
	if (id!=null && ThreatAssessment._all[id]!=null)
		bugreport("ThreatAssessment with id "+id+" already exists","ThreatAssessment.constructor");
	if (type=='tACT' || type=='tUNK' || type=='tNOT')
		bugreport("ThreatAssessment with id "+id+" has illegal type "+type,"ThreatAssessment.constructor");
	this.id = (id==null ? nextUnusedIndex(ThreatAssessment._all) : id);
	this.type = type;
	this.component = null;
	this.cluster = null;
	this.title = _("Vulnerability ")+this.id;
	this.description = "";
	this.freq='-';
	this.impact='-';
	this.total='-';
	this.remark="";
	
	this.store();
	ThreatAssessment._all[this.id]=this;
};
ThreatAssessment.get = function(id) { return ThreatAssessment._all[id]; };
ThreatAssessment._all = [];
ThreatAssessment.Clipboard = [];
ThreatAssessment.values =[
'-', // unspecified
'A', // ambiguous
'U', // extreme (ultra low)
'L', // low
'M', // medium
'H', // high
'V', // extreme (very high)
'X'  // unknown
];
ThreatAssessment.valueindex = [];
ThreatAssessment.valueindex['-']=0;
ThreatAssessment.valueindex['A']=1;
ThreatAssessment.valueindex['U']=2;
ThreatAssessment.valueindex['L']=3;
ThreatAssessment.valueindex['M']=4;
ThreatAssessment.valueindex['H']=5;
ThreatAssessment.valueindex['V']=6;
ThreatAssessment.valueindex['X']=7;
ThreatAssessment.descr = [
	_("Undetermined"),
	_("Ambiguous"),
	_("Extremely low"),
	_("Low"),
	_("Medium"),
	_("High"),
	_("Extremely high"),
	_("Unknown")
];
/* Combine all risk factors into a combined total score for a single threat
 * ThreatAssessment.combine[freq][impact], where
 * freq and impact = ThreatAssessment.valueindex[...]
 */
ThreatAssessment.combinearr = [
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
ThreatAssessment.combine = function(a,b) {
	return ThreatAssessment.combinearr[ThreatAssessment.valueindex[a]][ThreatAssessment.valueindex[b]];
};
/* Combine two totals into an overall vulnerability score
 * For threats totals t0, t1, ..., tn the overall score is
 * ThreatAssessment.sum(tn, ThreatAssessment.sum(tn-1, ... (t1, t0)) ...)
 * Score = t0 (+) t1 (+) ... (+) tn
 * a (+) b == b (+) a
 * 'U' (+) x == x
 */
ThreatAssessment.sumarr = [
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
ThreatAssessment.sum = function(a,b) {
	return ThreatAssessment.sumarr[ThreatAssessment.valueindex[a]][ThreatAssessment.valueindex[b]];
};
ThreatAssessment.worst = ThreatAssessment.sum;

ThreatAssessment.prototype = {
	destroy: function() {
		localStorage.removeItem(LS + 'E:' + this.id);
		if (Component.ThreatsComponent==this.component)
			$('#dth'+this.id).remove();
		ThreatAssessment._all[this.id]=null;
	},
	
//	_isblank: function() {
//		return (this.freq=='-' && this.impact=='-' && this.remark=="");
//	},
	
	setcomponent: function(id) {
		this.component = id;
		if (this.cluster!=null)
			bugreport("threat evaluation belongs to both a component and a NodeCluster", "ThreatAssessment.setcomponent");
		this.store();
	},
	
	setcluster: function(id) {
		this.cluster = id;
		if (this.component!=null)
			bugreport("threat evaluation belongs to both a component and a NodeCluster", "ThreatAssessment.setcluster");
		this.store();
	},
	
	settitle: function(t) {
		t = trimwhitespace(String(t)).substr(0,50);
		if (t=="")
			// Silently ignore an attempt to set a blank title
			return;
		if (this.component!=null) {
			// If the component already contains a threat with title "t" and the same type,
			// then silently revert to the old title.
			var cm = Component.get(this.component);
			for (var i=0; i<cm.thrass.length; i++) {
				if (cm.thrass[i]==this.id) continue;
				var ta = ThreatAssessment.get(cm.thrass[i]);
				if (ta.title==t && ta.type==this.type)
					// silently ignore
					return;
			}
			NodeCluster.removecomponent_threat(Project.cid,this.component,this.title,this.type,true);
			this.title = t;
			NodeCluster.addcomponent_threat(Project.cid,this.component,this.title,this.type,false);
		} else {
			this.title = t;
		}
		this.store();
	},
	
	_setparentmarker: function() {
		if (this.component!=null)
			Component.get(this.component).setmarker();
		if (this.cluster!=null)
			NodeCluster.get(NodeCluster.get(this.cluster).root()).setmarker();
	},

	setdescription: function(t) {
		this.description = trimwhitespace(String(t)).substr(0,100);
		this.store();
	},

	setfreq: function(v) {
		this.freq = (jQuery.inArray(v,ThreatAssessment.values)>-1 ? v : 'X');
		this.computetotal();
		this.store();
	},

	setimpact: function(v) {
		this.impact = (jQuery.inArray(v,ThreatAssessment.values)>-1 ? v : 'X');
		this.computetotal();
		this.store();
	},

	computetotal: function() {
		this.total = ThreatAssessment.combine(this.freq,this.impact);
		if (this.component!=null)
			Component.get(this.component).calculatemagnitude();
		if (this.cluster!=null)
			NodeCluster.get(NodeCluster.get(this.cluster).root()).calculatemagnitude();
	},
	
	setremark: function(t) {
		this.remark = trimwhitespace(String(t)).substr(0,200);
		this.store();
	},

	addtablerow_textonly: function(prefix,interact) {
		if (interact==null) interact=true;
		var snippet = '<div id="dth_PF___TI_" class="threat">\
			<div id="dth__PF_name_TI_" class="th_name th_col"><span>_TT_</span></div>\
			<div id="dth__PF_freq_TI_" class="th_freq th_col"><span>_DF_</span></div>\
			<div id="dth__PF_impact_TI_" class="th_impact th_col"><span>_DI_</span></div>\
			<div id="dth__PF_total_TI_" class="th_total th_col">_TO_</div>\
			<div id="dth__PF_remark_TI_" class="th_remark th_col"><span>_DR_</span></div>';
		if (interact)
			snippet += '<div class="th_del th_col"><input id="dth__PF_del_TI_" type="button" value="&minus;"></div>';
		snippet += '</div>\n';
		snippet = snippet.replace(/_TI_/g, this.id);
		snippet = snippet.replace(/_TT_/g, H(this.title));
		snippet = snippet.replace(/_TO_/g, this.total);
		snippet = snippet.replace(/_PF_/g, prefix);
		snippet = snippet.replace(/_DF_/g, this.freq);
		snippet = snippet.replace(/_DI_/g, this.impact);
		snippet = snippet.replace(/_DR_/g, H(this.remark));
		return snippet;
	},
	
	addtablerow: function(oid,prefix,interact) {
		if (interact==null) interact=true;
		$(oid).append( this.addtablerow_textonly(prefix,interact) );
		this.addtablerow_behavioronly(oid,prefix,interact);
	},
	
	addtablerow_behavioronly: function(oid,prefix,interact) {
		if (interact==null) interact=true;

		if (this.component!=null && Component.get(this.component).type=='tUNK') {
			$("#dth_"+prefix+"name"+this.id).attr('title', _("For %%: ",Rules.nodetypes[this.type]) + H(this.description));
		} else {
			$("#dth_"+prefix+"name"+this.id).attr('title', H(this.description));
		}
		if (interact) {
			$("#dth_"+prefix+"del"+this.id).button().removeClass('ui-corner-all').addClass('ui-corner-right');
		}
		
//		var selectoptions = ThreatAssessment.values.join(",");
		var selectoptions = "";
		for (var i=0; i<ThreatAssessment.values.length; i++) {
			if (selectoptions!="")
				selectoptions += ',';
			selectoptions += '_L_ _D_:_L_';
			selectoptions = selectoptions.replace(/_L_/g, ThreatAssessment.values[i]);
			selectoptions = selectoptions.replace(/_D_/g, ThreatAssessment.descr[i]);
		}
		var te = this;
		var c;

		if (this.component==null && this.cluster==null)
			bugreport('neither .component nor .cluster is set','this.addtablerow');
		if (this.component!=null)
			c = Component.get(this.component);
		var nc_isroot = false;
		if (this.cluster!=null) {
			c = NodeCluster.get(this.cluster);
			nc_isroot = c.isroot();
		}
		
		if (!nc_isroot) $("#dth_"+prefix+"name"+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			callback: function(oid, enteredText) {
				te.settitle(enteredText);
				te.setdescription(""); // Description from checklist does not apply anymore now.
				$("#dth_"+prefix+"name"+te.id).attr('title', '');
				if (c.parentcluster != undefined) {
					// c is a nodecluster, not a component
					c.settitle(te.title);
					$('#litext'+c.id).html(H(te.title));
				}
				transactionCompleted("Vuln rename");
				return H(te.title);
			}
		});
		$("#dth_"+prefix+"freq"+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			field_type: "select",
			select_options: selectoptions,
			select_text: "",
			callback: function(oid, enteredText) {
				te.setfreq(enteredText);
				$("#dth_"+prefix+"total"+te.id).text(te.total);
				c.setmarker();
				transactionCompleted("Vuln setfreq");
				return enteredText; 
			}
		});
		$("#dth_"+prefix+"impact"+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			field_type: "select",
			select_options: selectoptions,
			select_text: "",
			callback: function(oid, enteredText) {
				te.setimpact(enteredText);
				$("#dth_"+prefix+"total"+te.id).text(te.total);
				c.setmarker();
				transactionCompleted("Vuln setimpact");
				return enteredText; 
			}
		});
		$("#dth_"+prefix+"remark"+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			default_text: "-",
			callback: function(oid, enteredText) {
				te.setremark(enteredText);
				transactionCompleted("Vuln setremark");
				return H(te.remark); 
			}
		});
	
		if (interact) $("#dth_"+prefix+"del"+this.id).on('click',  function() {
			var th = ThreatAssessment.get(nid2id(this.id));
			var c;
			if (th.component!=null) {
				c = Component.get(th.component);
			} else
				bugreport("Was expecting a Component","ThreatAssessment.addtablerow");
			var dokill = function() {
				c.removethrass(th.id);
				var nc = NodeCluster.removecomponent_threat(Project.cid,th.component,th.title,th.type);
				// Remove the node cluster if it became empty
				if (nc.isempty())
					nc.destroy();
				$('#dth'+prefix+'_'+th.id).remove();
				c.setmarker();
				transactionCompleted("Vuln delete");
			};
			newRasterConfirm(_("Delete vulnerability?"),
				_("Vulnerabilities should only be deleted when physically impossible.")+
				'<br>\n'+
				_("Are you sure that '%%' for '%%' is nonsensical?", H(th.title),H(c.title)),
				_("It's impossible"),_("Cancel")
			).done(dokill);
		});
	},

	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.m=this.component;
		data.u=this.cluster;
		data.l=this.title;
		data.d=this.description;
		data.p=this.freq;
		data.i=this.impact;
		data.r=this.remark;
		return JSON.stringify(data);
	},
	
	exportstring: function() {
		var key = LS+'E:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},
	
	store: function() {
		var key = LS+'E:'+this.id;
		localStorage[key] = this._stringify();
	}
};

var DefaultThreats = [
/* [ type , title , description ] */
["tWLS",_("Interference"),		_("Unintentional interference by a radio source using the same frequency band.")],
["tWLS",_("Jamming"),			_("Intentional interference by some third party.")],
["tWLS",_("Congestion"),		_("The amount of traffic offered exceeds the capacity of the link.")],
["tWLS",_("Signal weakening"),	_("Loss of signal strength through distance or blocking by buildings, trees, etc.")],
["tWRD",_("Break"),				_("Cable damaged by natural events, trenching, anchors, or other external influence.")],
["tWRD",_("Congestion"),		_("The amount of traffic offered exceeds the capacity of the link.")],
["tWRD",_("Cable aging"),		_("Insulation weakens with age.")],
["tWRD",_("EMC"),				_("Electromagnetic influences from neighbouring cables or radio sources.")],
["tEQT",_("Physical damage"),	_("Fire, flood, knocks and other physical damage inflicted.")],
["tEQT",_("Power"),				_("Failure of electrical power supply.")],
["tEQT",_("EMC"),				_("Electromagnetic influences from neighbouring cables or radio sources.")],
["tEQT",_("Configuration"),		_("Incorrect configuration or mistakes by operators.")],
["tEQT",_("Malfunction"),		_("Failure of an internal module without a clear external cause, possibly by aging.")]
];

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * Threat: sample threat in a checklist.
 *
 * Class variables (those prefixed with underscore should not be accessed from outside)
 *	_all[]: all Threat objects, indexed by id
 *	get(i): returns the object with id 'i'.
 * Instance properties:
 *	type: one of 'tWLS','tWRD','tEQT'. Actors and unknown links don't have threats.
 *	id: unique number.
 *	project: ID of the project to which this threat belongs.
 *	title: short name of the threat.
 *	description: description of the threat.
 * Methods:
 *	destroy: destructor.
 *	setproject(p): sets the project to 'p'.
 *	settitle(str): sets the short name text to 'str'.
 *	addtablerow(oid): append a table row to HTML element 'oid', including interactions.
 *	setdescription(str): sets the full description text to 'str'.
 *	_stringify: create a JSON text string representing this object's data.
 *	exportstring: return a line of text for insertion when saving this file.
 *	store(): store the object into localStorage.
 */
var Threat = function(type,id) {
	if (id!=null && Threat._all[id]!=null)
		bugreport("Vulnerability with id "+id+" already exists","Threat.constructor");
	this.id = (id==null ? nextUnusedIndex(Threat._all) : id);
	this.type = type;
	this.project = Project.cid;
	this.title = _("Vulnerability ")+this.id;
	this.description = _("Description threat ")+this.id;
	
	this.store();
	Threat._all[this.id]=this;
};
Threat.get = function(id) { return Threat._all[id]; };
Threat._all = [];
Threat.prototype = {
	destroy: function() {
		localStorage.removeItem(LS + 'T:' + this.id);
		$('#threat'+this.id).remove();
		Threat._all[this.id]=null;
	},
	
	setproject: function(p) {
		this.project = p;
		this.store();
	},

	settitle: function(t) {
		t = trimwhitespace(String(t)).substr(0,50);
		if (t=="")
			// Silently ignore a blank title
			return;
		// See if this title already exists. If so, silently ignore
		var it = new ThreatIterator(this.project,this.type);
		for (it.first(); it.notlast(); it.next()) {
			var th = it.getthreat();
			if (th.id==this.id) continue;
			if (th.title==t) return;
		}
		this.title = t;
		this.store();
	},

	addtablerow: function(oid) {
		var snippet = '<div id="threat_TI_" class="threat">\
			<div id="thname_TI_" class="th_col th_name"><span>_TN_</span></div>\
			<div id="thdesc_TI_" class="th_col th_descr"><span>_TD_</span></div>\
			<div class="th_col th_del"><input id="thdel_TI_" type="button" value="&minus;"></div>\
			</div>\n';
		snippet = snippet.replace(/_TI_/g, this.id);
		snippet = snippet.replace(/_TT_/g, Rules.nodetypes[this.type]);
		snippet = snippet.replace(/_TN_/g, H(this.title));
		snippet = snippet.replace(/_TD_/g, H(this.description));
		$(oid).append(snippet);
		$('#thdel'+this.id).button();
		$('#thdel'+this.id).removeClass('ui-corner-all').addClass('ui-corner-right');
	
		$('#thname'+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			callback: function(domid, enteredText) { 
				var th = Threat.get( nid2id(domid) );
				th.settitle(enteredText);
				transactionCompleted("Checklist rename");
				return H(th.title); 
			}
		});
		$('#thdesc'+this.id).editInPlace({
			bg_out: "#eee", bg_over: "rgb(255,204,102)",
			callback: function(domid, enteredText) { 
				var th = Threat.get( nid2id(domid) );
				th.setdescription(enteredText);
				transactionCompleted("Checklist description");
				return H(th.description); 
			}
		});
		$('#thdel'+this.id).on('click',  function() {
			var th = Threat.get(nid2id(this.id));
			newRasterConfirm(_("Delete vulnerability?"),
				_("Do you want to delete the vulnerability '%%' for '%%' nodes?", H(th.title), Rules.nodetypes[th.type]),
				_("Remove"),_("Cancel")
			)
			.done(function() {
				Project.get(th.project).removethreat(th.id); 
				transactionCompleted("Checklist remove");
			});
		});
	},

	setdescription: function(t) {
		this.description = trimwhitespace(String(t)).substr(0,100);
		this.store();
	},

	_stringify: function() {
		var data = {};
		data.t=this.type;
		data.l=this.title;
		data.d=this.description;
		data.p=this.project;
		return JSON.stringify(data);
	},
	
	exportstring: function() {
		var key = LS+'T:'+this.id;
		return key + '\t' + this._stringify() + '\n';
	},
	
	store: function() {
		var key = LS+'T:'+this.id;
		localStorage[key] = this._stringify();
	}
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
 * ThreatIterator: iterate over all threats for a project of a certain type
 *
 * usage:
 * 		var it = new ThreatIterator(project,type);
 * 		for (it.first(); it.notlast(); it.next()) {
 *			var th = it.getthreat();
 *	 		:
 *		}
 */
var ThreatIterator = function(pid,t) {
	this.index = 0;
	this.item = [];
	for (var i=0,alen=Threat._all.length; i<alen; i++) {
		if (Threat._all[i]!=null 
		 && Threat._all[i].project==pid 
		 && (t=='tUNK' || t==Threat._all[i].type)) 
			this.item.push(i);
	}
	this.itemlength=this.item.length;
};

ThreatIterator.prototype = {
	first: function() {this.index=0;},
	next: function() {this.index++;},
	notlast: function() {return (this.index < this.itemlength);},
	getthreat: function() {return Threat.get( this.item[this.index] );},
	getthreatid: function() {return this.item[this.index];}
};

