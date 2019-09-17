//statusticket.js
//jQuery library for animated status popups.
//TODO: Should probably be a widget, also dehardcode some things if possible

class StatusTicket {
	constructor(statusContainer,
		{initText = "Working...",
		 iconClass = "spinner-sm",
		 bgColor = "ff0",
		 fgColor = "000",
		 timeout = -1,
		 opacity = 0.7,
		 width = "250px",
		 fadeInTime = 500,
		 fadeOutTime = 500,
		} = {}) { //defaults in an options object, courtesy of premium ES6 fuckery
		this.BgHandle = $("<div>", {"class": "statusticket", "style": "opacity:0;width:0;background-color:"+bgColor+";color:"+fgColor});
		this.TextHandle = $("<span>", {"class": "statustext"});
		this.IconHandle = $("<div>", {"class": iconClass, "style": "margin-top: 3px;"});
		this.BgHandle.append(this.IconHandle);
		this.BgHandle.append(this.TextHandle);
		this.Text = initText;
		this.FadeOutTime = fadeOutTime;
		statusContainer.append(this.BgHandle);
		if(fadeInTime == 0)
			this.BgHandle.css({'opacity':opacity, 'width':width});
		else
			this.BgHandle.animate({'opacity':opacity, 'width':width}, 500);
	
		if(timeout > -1) {
			setTimeout((function(self){
				return function() {
					self.close();
				}
			})(this), timeout);
		}
	}
	get Text() {
		return this._Text;
	}
	set Text(t) {
		this._Text = t;
		this.TextHandle.text(t);
	}
	close() {
		if(this.FadeOutTime == 0)
			this.remove();
		else
			this.BgHandle.animate({opacity: 0, width: 0}, this.FadeOutTime, function() {
				this.remove();
			});
	}
}