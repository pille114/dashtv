
// refactored by: moocowmoo - moocowmoo@dash.org

// dashtv object instantiation
(function(scope, endpoint){

    // set locale for page and number formatting
    var i18n_init = function(){
        var lang = (navigator.language || navigator.systemLanguage || navigator.userLanguage);
        try {
            numeral.language(lang);
            $("html").attr("lang", lang);
        }
        catch(e) {
            lang = lang.substr(0, 2).toLowerCase();
            try {
                numeral.language(lang);
            }
            catch(e) {
                numeral.language('en');
            }
            $("html").attr("lang", lang);
        }
    };

    // format numbers to different decimal places
    var fmtCurr = function (num, c) {
        var fmt = '0,0';
        if (c > 0) {
            fmt += '.';
            while(c > 0){
                fmt += '0';
                c--;
            }
        }
        return numeral(num).format(fmt);
    }

    // conditionally truncate decimal places for display
    var fmtCurrShort = function(input){
        if(math.round(input).toString().length > 3){
            return fmtCurr(input, 0);
        }
        return fmtCurr(input, 2);
    }

    // dashtv object definition
    var DTV = (function(endpoint){

        return {

            // base url to poll for data
            endpoint: endpoint,

            // jquery selector cache
            selectors: {},

            // initial state
            data: {
                polling: 0,
                dash: 1000,
                curr: "USD",
                addr: null,
                mn: 1,
                rate: 1,
                fiatprice: 1,
                toggle: false,
                formatted: {},
            },

            // entry point -- initialize data and page
            init: function() {

                // redirect to # url if legacy
                var wl = window.location;
                if (wl.search) {
                    wl.href = wl.protocol + "//" + wl.hostname + wl.pathname + "#" + wl.search.substring(1);
                }

                // display loading spinner overlay until render complete
                $("#loading").css("display", "block");

                // setup language
                i18n_init();

                // cache jquery selectors
                this.cacheSelectors();
				
				// keyboard & mouse inputs				
				this.hwInputs();

                // parse url for input
                this.parseUrl();

                // reference for callbacks
                var self = this;

                // get initial data
                this.pollDashData(self);

                // set polling timers
                setInterval( function(){ self.pollDashData(self)}, 60 * 1000);  // once per minute
                setInterval( function(){ self.pollUserData(self)}, 60 * 60 * 1000);  // once per hour

                // pull any needed data and refresh page
                this.reload();
            },

            // update object with latest dash data
            pollDashData: function(self) {
                self.data.polling += 1;

                if(self.data.curr != "USD"){
                    self.data.polling += 1;
                    $.getJSON(this.endpoint + "curr.json", function(result){
                        if(typeof result[self.data.curr] != "undefined"){
                            self.data.rate = result[self.data.curr];
                        }
                        self.data.polling -= 1;
                    });
                }
                else {
                    self.data.rate = 1;
                }

                $.getJSON( self.endpoint + "data.json", function(result){
                    if(typeof result["totalsupply"] != "undefined"){
                        //result["totalsupply"] = result["totalsupply"].replace(/\,/g, "");
                        for ( key in result ) {
                            self.data[key] = result[key];
                        };
                        self.redraw();
                    };
                    self.data.polling -= 1;
                });
            },

            // update object with latest user balance
            pollUserData: function() {
                // pull addr balance if present
                if (this.data.addr) {
                    var self = this;
                    self.data.polling += 1;
                    $.post(this.endpoint + 'value.php', {addr: this.data.addr}, function(result){
                        if (result != undefined) {
                            self.updateData({dash: result});
                        }
                        self.data.polling -= 1;
                    });
                }
            },

            // updates values and redraw screen
            reload: function(){

                // defer reload if still polling
                if (this.data.polling){
                    var self = this;
                    setTimeout(function(){self.reload();}, 200);
                    return;
                }

                // parse url for input
                this.parseUrl();

                // get addr balance if supplied
                this.pollUserData();

                // pull fresh data on currency change
                if ( this.data.lastcurr != this.data.curr) {

                    // get latest dash data
                    var self = this;
                    this.pollDashData(self);
                }

                // update the page content
                this.redraw();

            },

            cacheSelectors: function(){
                var s = this.selectors;

                s.currency_labels = $("span.c");

                s.value_main        = $("#value>div.v");
                s.value_fiatMonth   = $("#fiatMonth>div.v");
                s.value_fiatDay     = $("#fiatDay>div.v");
                s.value_fiatDash    = $("#fiatDash>div.v");
                s.value_fiatBTC     = $("#fiatBTC>div.v");
                s.value_dash        = $("#dashValue>div.v");
                s.value_dashMonth   = $("#dashMonth>div.v");
                s.value_dashDay     = $("#dashDay>div.v");
                s.value_btcDash     = $("#btcDash>div.v");
                s.value_shareMn     = $("#shareMn>div.v");
                s.value_shareSupply = $("#shareSupply>div.v");
                s.value_interest    = $("#interest>div.v");
				s.update_bar		= $("#update_bar");

            },
			
			hwInputs: function(){
				var s   = this.selectors;
				
				$(document).keydown(function(key){
					switch(key.which){
						//'P' update-bar
						case 80:
							if( s.update_bar	.css("visibility")==="hidden"){
								s.update_bar 	.css("visibility", "visible");	
							}else{
								s.update_bar	.css("visibility", "hidden");		
							}
							break;					
						//'T' theme
						case 84:
							$("body").toggleClass("light");
							break;
						//'H' help
						case 72:
							$("#help").toggle();
							break;
					}			
					
				});		
				
				$(".t").click(function (e) {
    					e.stopPropagation();
    					jQuery(this).children(this).toggle();
				});
			},

            // renders page
            redraw: function(){

                // defer redraw if still polling
                if (this.data.polling){
                    var self = this;
                    setTimeout(function(){self.redraw();}, 200);
                    return;
                }

                // calculate the latest data for render
                this.updateData();

                var data = this.data;

                this.toggle = !this.toggle;
                switch(this.toggle) {
                    case true:
                        document.title = "DashTV - " + fmtCurrShort(data.dash * data.fiatprice) + " " + this.data.curr;
                        break;
                    case false:
                        document.title = "DashTV - " + fmtCurrShort(data.fiatprice) + " " + this.data.curr;
                        break;
                };

                var s   = this.selectors;
                var fmt = this.data.formatted;

                // populate currency labels
                s.currency_labels   .html(data.curr)
                
                // populate values
                s.value_main        .html(fmt.value      );
                s.value_fiatMonth   .html(fmt.fiatMonth  );
                s.value_fiatDay     .html(fmt.fiatDay    );
                s.value_fiatDash    .html(fmt.fiatDash   );
                s.value_fiatBTC     .html(fmt.fiatBTC    );
                s.value_dash        .html(fmt.dashValue  );
                s.value_dashMonth   .html(fmt.dashMonth  );
                s.value_dashDay     .html(fmt.dashDay    );
                s.value_btcDash     .html(fmt.btcDash    );
                s.value_shareMn     .html(fmt.shareMn    );
                s.value_shareSupply .html(fmt.sharesupply);
                s.value_interest    .html(fmt.interest   );

                $("#loading").css("display", "none");

            },

            // updates internal data values from pulls
            updateData: function(o) {

                // update any values submitted
                for (key in o) {
                    this.data[key] = o[key];
                }

                this.data.mn = math.floor(this.data.dash/1000);
                this.data.fiatprice = this.data.pricebtcusd * this.data.btcprice * this.data.rate;
                this.data.fiatbtc = this.data.pricebtcusd * this.data.rate;

                var fmt  = this.data.formatted;
                var data = this.data;

                fmt.value       = fmtCurrShort(data.dash * data.fiatprice);
                fmt.fiatMonth   = fmtCurrShort(data.dashdaily * 365 / 12 * data.fiatprice * data.mn);
                fmt.fiatDay     = fmtCurrShort(data.dashdaily * data.fiatprice * data.mn);
                fmt.fiatDash    = fmtCurrShort(data.fiatprice);
                fmt.fiatBTC     = fmtCurrShort(data.fiatbtc);
                fmt.dashValue   = fmtCurrShort(data.dash);
                fmt.dashMonth   = fmtCurrShort(data.dashdaily * 365 / 12 * data.mn);
                fmt.dashDay     = fmtCurrShort(data.dashdaily * data.mn);
                fmt.btcDash     = fmtCurr(data.btcprice, 5);
                fmt.shareMn     = fmtCurr(data.mn / data.mncount * 100, 2) + "%";
                fmt.interest    = fmtCurr(data.dashdaily * 365/1000 * 100, 2) + "%";
                fmt.sharesupply = fmtCurr(data.dash/data.totalsupply * 100, 3) + "%";

            },

            // extract user data from url
            parseUrl: function() {
                this.data.lastcurr = this.data.curr;
                this.data['addr'] = null;
                this.data['curr'] = 'USD';
                var hash = window.location.hash.substring(1);
                var vars = hash.split("&");
                for (var i=0;i<vars.length;i++) {
                    var pair = vars[i].split("=");
                    this.data[pair[0]] = pair[1];
                }

                // support legacy variable name 'value'
                if (this.data.value) {
                    this.data.dash = this.data.value;
                }
            }

        };

    })(endpoint);

    // attach DTV object to window scope
    scope.dashtv = DTV;

})(this, 'https://dash-news.de/dashtv/');


// invoke dashtv.init() on page load
$(document).ready(function(){

    // attach hash-change handler
    window.onhashchange = function(){ dashtv.reload(); };

    // launch it!
    dashtv.init();
});
