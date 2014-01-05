/*!
 * $Id: ui.tabs.closable.js,v 1.1.1.1 2011/07/28 10:59:23 vriezekolke Exp $
 *
* Copyright (c) 2010 Andrew Watts
*
* Dual licensed under the MIT (MIT_LICENSE.txt)
* and GPL (GPL_LICENSE.txt) licenses
*
* http://github.com/andrewwatts/ui.tabs.closable
*/
(function() {
    
var ui_tabs_tabify = $.ui.tabs.prototype._tabify;

$.extend($.ui.tabs.prototype, {

    _tabify: function() {
        var self = this;

        ui_tabs_tabify.apply(this, arguments);

        // if closable tabs are enable, add a close button
        if (self.options.close) {

            var unclosable_lis = this.lis.filter(function() {
                // return the lis that do not have a close button
                return $('span.ui-icon-circle-close', this).length === 0;
            });

            // append the close button and associated events
            unclosable_lis.each(function() {
                $(this)
                    .append('<a href="#" style="width:16px;padding-left:0px;padding-right:5px;"><span class="ui-icon ui-icon-circle-close"></span></a>')
                    .find('a:last')
                        .hover(
                            function() {
                                $(this).css('cursor', 'pointer');
                            },
                            function() {
                                $(this).css('cursor', 'default');
                            }
                        )
                        .click(function() {
                            var index = self.lis.index($(this).parent());
                            if (index > -1) {
                                // call _trigger to see if remove is allowed
                                if (false === self._trigger("closableClick", null, self._ui( $(self.lis[index]).find( "a" )[ 0 ], self.panels[index] ))) return;

                                // remove this tab
                                (self.options.close)(index,this.previousSibling.hash);
                            }

                            // don't follow the link
                            return false;
                        })
                    .end();
            });
        }
    }
});
    
})(jQuery);
