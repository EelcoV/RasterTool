var _t = new Array;

function translate(s) {
    var str = _t[s];
    if (!str) {
    	console.log("_t['" + s + "'] = '';")
        str=s;
	}
    // Replace %1, %2, ... %9 by the first, second, ... ninth argument.
    //for (var i=1; i<10; i++) {
    //    str = str.replace("%"+i, arguments[i])
    //}
    var i = 1;
    while (i<arguments.length) {
        str = str.replace("%%", arguments[i]);
        i++;
    }
    return str;
}


exports.translate = translate;

_t['File'] = 'Bestand';
_t['New'] = 'Nieuw';
_t['Open...'] = 'Openen...';
_t['Save'] = 'Opslaan';
_t['Save as...'] = 'Opslaan als...';
_t['Save as PDF'] = 'Opslaan als PDF';
_t['Quit'] = 'Afsluiten';
_t['Close'] = 'Sluiten';
_t['Edit'] = 'Bewerken';
_t['Undo'] = 'Ongedaan maken';
_t['Redo'] = 'Opnieuw';
_t['Cut'] = 'Knippen';
_t['Copy'] = 'Kopiëren';
_t['Paste'] = 'Plakken';
_t['Select all'] = 'Alles selecteren';
_t['View'] = 'Beeld';
_t['Full screen'] = 'Volledig scherm';
_t['Developer tools'] = 'Ontwikkelhulpprogramma\'s';
_t['Window'] = 'Venster';
_t['Minimize'] = 'Minimaliseren';
_t['Close'] = 'Sluiten';
_t['Help'] = 'Help';
_t['Zoom'] = 'Zoom';
_t['Zoom in'] = 'Zoom in';
_t['Zoom out'] = 'Zoom uit';
_t['Reset'] = 'Herstel';
_t['Raster - No name'] = 'Raster - Naamloos';
_t['Discard changes'] = 'Wijzigingen negeren';
_t['Cancel'] = 'Annuleer';
_t['Discard all changes?'] = 'Wijzigingen negeren?';
_t['There are unsaved changes. If you continue those will be lost.'] = 'Er zijn wijzigingen die nog niet zijn opgeslagen. Als u doorgaat raken deze verloren.';
_t['Cancel to save changes.'] = 'Annuleer om de wijzigingen alsnog op te kunnen slaan.';
_t['Save project'] = 'Project opslaan';
_t['Project was not saved'] = 'Project is niet opgeslagen';
_t['System notification:'] = 'Het systeem meldt:';
_t['Open project'] = 'Project openen';
_t['Raster project'] = 'Raster project';
_t['All files'] = 'Alle bestanden';
_t['Cannot read the file'] = 'Kan het bestand niet inlezen';
_t['PDF files'] = 'PDF bestanden';
_t['File was not saved'] = 'Bestand is niet opgeslagen';
_t['Quick guide...'] = 'Snelle gids...';
_t['Cancel to save changes.'] = 'Annuleer om wijzigingen op te slaan.';
_t['Show labels'] = 'Laat labels zien';
_t['Hide labels'] = 'Verberg labels';
_t['Small vulnerability levels'] = 'Kleine kwetsbaarheidsindicator';
_t['Large vulnerability levels'] = 'Grote kwetsbaarheidsindicator';
_t['No vulnerability levels'] = 'Geen kwetsbaarheidsindicator';
_t['Details...'] = 'Details...';
_t['Find nodes...'] = 'Zoek componenten...';
_t[''] = '';

