
define(function(require, exports, module) {

    var Engine = require('famous/core/Engine');
    var View = require('famous/core/View');
    var ScrollView = require('famous/views/Scrollview');
    var ModifiedScrollView = require('views/common/ModifiedScrollView');
    var SequentialLayout = require('famous/views/SequentialLayout');
    var Lightbox = require('famous/views/Lightbox');
    var RenderController = require('famous/views/RenderController');
    var FlexibleLayout = require('famous/views/FlexibleLayout');
    var Surface = require('famous/core/Surface');
    var ImageSurface = require('famous/surfaces/ImageSurface');
    var Modifier = require('famous/core/Modifier');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Transitionable     = require('famous/transitions/Transitionable');
    var Transform = require('famous/core/Transform');
    var Matrix = require('famous/core/Transform');
    var RenderNode         = require('famous/core/RenderNode')

    var Utility = require('famous/utilities/Utility');
    var Timer = require('famous/utilities/Timer');

    var HeaderFooterLayout = require('famous/views/HeaderFooterLayout');

    var TabBar = require('famous/widgets/TabBar');
    var NavigationBar = require('famous/widgets/NavigationBar');
    var GridLayout = require("famous/views/GridLayout");

    var EventHandler = require('famous/core/EventHandler');

    var $ = require('jquery');
    var Credentials = JSON.parse(require('text!credentials.json'));

    // Views
    var StandardHeader = require('views/common/StandardHeader');
    var StandardTabBar = require('views/common/StandardTabBar');

    // Extras
    var Utils = require('utils');
    var numeral = require('lib2/numeral.min');
    var crypto = require('lib2/crypto');

    // Models
    var UserModel = require('models/user');
    // var GameModel = require('models/game');

    // Subviews

    // // Side menu of list of cars
    // var DashProfileMenuView      = require('views/Profile/DashProfileMenu');

    // // Profile Stories
    // var ProfileStoryListView      = require('views/Profile/ProfileStoryList');

    // // Game Blocks
    // var ProfileGameBlocksView      = require('views/Profile/ProfileGameBlocks');
    // // Game List
    // var ProfileGameListView      = require('views/Profile/ProfileGameList');

    // // Media Blocks
    // var ProfileMediaBlocksView      = require('views/Profile/ProfileMediaBlocks');

    function PageView(options) {
        var that = this;
        View.apply(this, arguments);
        this.options = options;

        // Are we getting a profile_id, or do we need to get the current user's profile_id?
        this.KnowProfileId = $.Deferred();
        var profile_id; 
        if(this.options.args.length > 0 && this.options.args[0]){
            // It is set
            // - resolve now
            profile_id = this.options.args[0];
            this.profile_id = this.options.args[0];
        } else {
            // Trying to go to the ond "Dash" (the current user)
            // Sometimes we don't immediately know the current owner's ID
            // this.KnowProfileId = $.Deferred();
            this.profile_id = App.Data.User.get('_id'); //localStorage.getItem('home_profile_id');
            // this.profile_id = profile_id && profile_id.length == 24 ? profile_id : false;
        }

        // If profile_id is set, then use it, otherwise get the user's profile_id)
        if(this.profile_id){
            // Resolve the KnowProfileId right away
            // - might use it later in a Deferred context
            this.KnowProfileId.resolve(this.profile_id);
        } else {
            // Determine my user._id
            App.Data.User.populated().then(function(){
                that.profile_id = App.Data.User.get('_id');
                that.KnowProfileId.resolve(App.Data.User.get('_id'));
            });
        }

        // create the layout
        this.layout = new HeaderFooterLayout({
            headerSize: App.Defaults.Header.size,
            footerSize: 60
        });


        this.createContent();
        this.createHeader();
        
        // Attach the main transform and the comboNode to the renderTree
        this.add(this.layout);

        // Models
        this.tmpModel = $.Deferred();

        this.KnowProfileId.promise().then(function(profile_id){

            // Get Profile (Me)
            that.model = new UserModel.User({
                profile_id: profile_id
            });
            that.model.fetch({prefill: true});

            that.model.populated().then(function(){

                // Show user information
                that.contentLightbox.show(that.contentScrollView);

                // The following is only run once
                that.is_me = true;

                // Show Edit or Connect
                // - determine is_me
                if(that.model.get('_id') == App.Data.User.get('_id')){
                    console.error('is_me!');
                    that.profileRight.Layout.show(that.profileRight.EditProfile);
                } else {
                    that.is_me = false;
                    console.error('Not is_me!');
                    var my_friend_profile_ids = _.pluck(App.Data.Profiles.toJSON(), '_id');
                    

                    // if(_.intersection(that.model.get('related_profile_ids'),my_friend_profile_ids).length > 0){
                    //     that.profileRight.Layout.show(that.profileRight.Connected);
                    // } else {
                        that.profileRight.Layout.show(that.profileRight.Connect);
                    // }
                }

                // compare/against
                // only do this one time
                if(that.is_me === false){

                    that.tabBar.defineSection('compare', {
                        content: '<i class="icon ion-android-contacts"></i><div>Compare</div>',
                        onClasses: ['profile-tabbar-default', 'on'],
                        offClasses: ['profile-tabbar-default', 'off']
                    });

                }

                // update going forward
                that.update_content();
                that.model.on('change', that.update_content.bind(that));

            });

        });

        // window.setTimeout(function(){
        //     KnowProfileId.resolve("529c02f00705435badb1dff5");
        // },3000);

    }

    PageView.prototype = Object.create(View.prototype);
    PageView.prototype.constructor = PageView;


    PageView.prototype.createHeader = function(){
        var that = this;
        
        // Icons

        // -- settings (lightbox)
        this.headerContent = new View();
        this.headerContent.Lightbox = new RenderController();
        this.headerContent.SizeMod = new StateModifier({
            size: [60, 50]
        });
        this.headerContent.add(this.headerContent.SizeMod).add(this.headerContent.Lightbox);
        this.headerContent.Settings = new Surface({
            content: '<i class="icon ion-gear-a"></i><div>Settings</div>',
            size: [60, undefined],
            classes: ['header-tab-icon-text']
        });
        this.headerContent.Settings.on('click', function(){
            App.history.navigate('settings');
        });
        // - spacer1
        this.headerContent.spacer1 = new Surface({
            content: '<span></span>',
            size: [16, undefined],
            classes: ['header-tab-spacer-default']
        });

        // - search (always visible)
        this.headerContent.Search = new Surface({
            content: '<i class="icon ion-search"></i><div>Search</div>',
            size: [60, undefined],
            classes: ['header-tab-icon-text']
        });
        this.headerContent.Search.on('click', function(){
            App.history.navigate('users/search');
        });

        // create the header
        this.header = new StandardHeader({
            content: '', //App.Data.User.get('email').split('@')[0].split('+')[0],
            classes: ["normal-header", "profile-header"],
            backClasses: ["normal-header"],
            moreClasses: ["normal-header"],
            // moreContent: "Profiles",
            // backContent: "+Game"
            // moreContent: false,
            moreSurfaces: [
                this.headerContent,
                this.headerContent.spacer1,
                this.headerContent.Search
            ],
            backContent: false
        }); 
        this.header._eventOutput.on('back',function(){
            App.history.back();
            // App.history.navigate('game/add',{history: false});
        });
        this.header.navBar.title.on('click',function(){
            // rewrite the event
            // that.ProfileGameListView.collection.requestNextPage();
            if(that.is_me){
                // App.history.navigate('settings');
            } else {
                App.history.back();
            }
        });
        this.header.pipe(this._eventInput);

        // this._eventInput.on('menutoggle', this.menuToggle.bind(this));
        this._eventOutput.on('inOutTransition', function(args){
            this.header.inOutTransition.apply(this.header, args);
        })

        // // Node for Modifier and background
        // this.HeaderNode = new RenderNode();
        // this.HeaderNode.add(this.headerBg);
        // this.HeaderNode.add(this.header.StateModifier).add(this.header);

        // Attach header to the layout        
        this.layout.header.add(this.header);

    };

    PageView.prototype.createContent = function(){
        var that = this;

        // create the content
        this.contentScrollView = new ModifiedScrollView(App.Defaults.ScrollView);
        this.contentScrollView.Views = [];
        this.contentScrollView.sequenceFrom(this.contentScrollView.Views);

        // top of profile
        // - profile stuff
        // - basic win/loss details
        this.profileLayout = new View();
        this.profileLayout.SizeMod = new StateModifier({
            size: [undefined, 140]
        });
        this.profileLayout.SeqLayout = new FlexibleLayout({
            ratios: [true, 4, 200, 4]
        });
        this.profileLayout.SeqLayout.Views = [];
        this.profileLayout.add(this.profileLayout.SizeMod).add(this.profileLayout.SeqLayout);

        // Left Side
        // - image and profile name
        this.profileLeft = new View();
        this.profileLeft.SizeMod = new StateModifier({
            size: [100, undefined]
        });
        this.profileLeft.SeqLayout = new SequentialLayout();
        this.profileLeft.SeqLayout.Views = [];

        // Spacer
        this.profileLeft.topSpacer1 = new Surface({
            content: '',
            size: [undefined, 10]
        });
        this.profileLeft.SeqLayout.Views.push(this.profileLeft.topSpacer1);

        // Profile Image
        this.profileLeft.ProfileImage = new View();
        this.profileLeft.ProfileImage.StateModifier = new StateModifier({
            origin: [0.5,0],
            // size: [undefined, 100]
        });
        this.profileLeft.ProfileImage.Surface = new ImageSurface({
            content: 'img/generic-profile.png',
            size: [80,80],
            properties: {
                borderRadius: "50%",
                border: "1px solid #444"
            }
        });
        this.profileLeft.ProfileImage.add(this.profileLeft.ProfileImage.StateModifier).add(this.profileLeft.ProfileImage.Surface);
        this.profileLeft.ProfileImage.Surface.on('click', function(){
            // Refresh, easy to do
            that.model.fetch();
            if(that.is_me){
                // Launch options for photo

                // Slide to the change screen for the user
                // that.previousPage = window.location.hash;

                // Options and details
                App.Cache.OptionModal = {
                    list: [
                        {
                            text: "Take Photo with Camera",
                            value: "camera"
                        },
                        {
                            text: "Choose from Gallery",
                            value: "gallery"
                        }
                    ],
                    on_choose: function(chosen_type){
                        switch(chosen_type.value){
                            case 'camera':
                                Utils.takePicture('camera', {}, that.uploadProfileImage.bind(that), function(message){
                                    // failed taking a picture
                                });
                                break;
                            case 'gallery':
                                Utils.takePicture('gallery', {}, that.uploadProfileImage.bind(that), function(message){
                                    // failed taking a picture
                                });
                                break;
                            default:
                                return;
                        }
                        // App.history.navigate(that.previousPage);
                    },
                    on_cancel: function(){
                        // App.history.navigate(that.previousPage);
                    },
                    title: 'Set a Profile Picture'
                };

                // Change history (must)
                App.history.navigate('modal/list', {history: false});

            }
        });
        this.profileLeft.ProfileImage.pipe(this.contentScrollView);
        this.profileLeft.SeqLayout.Views.push(this.profileLeft.ProfileImage);

        // Spacer
        this.profileLeft.topSpacer3 = new Surface({
            content: '',
            size: [undefined, 10]
        });
        this.profileLeft.SeqLayout.Views.push(this.profileLeft.topSpacer3);

        // Profile Name
        this.profileLeft.ProfileName = new View();
        this.profileLeft.ProfileName.StateModifier = new StateModifier({
            // origin: [0.5, 0]
        });
        this.profileLeft.ProfileName.Surface = new Surface({
            content: '',
            size: [undefined, 40],
            // size: [undefined,80],
            // classes: ['ellipsis'],
            properties: {
                backgroundColor: 'white',
                color: '#333',
                fontSize: "12px",
                fontWeight: "bold",
                textAlign: "center"
            }
        });
        this.profileLeft.ProfileName.add(this.profileLeft.ProfileName.StateModifier).add(this.profileLeft.ProfileName.Surface);
        this.profileLeft.SeqLayout.Views.push(this.profileLeft.ProfileName);

        this.profileLeft.SeqLayout.sequenceFrom(this.profileLeft.SeqLayout.Views);

        this.profileLeft.add(this.profileLeft.SizeMod).add(this.profileLeft.SeqLayout);
        this.profileLayout.SeqLayout.Views.push(this.profileLeft);

        // Left-spacer
        this.profileLeft.SpacerMidLeft = new Surface({
            content: '',
            size: [undefined, 1]
        });
        this.profileLayout.SeqLayout.Views.push(this.profileLeft.SpacerMidLeft);

        // Right
        this.profileRight = new View();
        this.profileRight.SeqLayout = new SequentialLayout();
        this.profileRight.SeqLayout.Views = [];

        // Spacer
        this.profileRight.topSpacer2 = new Surface({
            content: '',
            size: [undefined, 20]
        });
        this.profileRight.SeqLayout.Views.push(this.profileRight.topSpacer2);

        // Quote
        this.profileRight.Quote = new View();
        this.profileRight.Quote.SizeMod = new StateModifier({
            size: [undefined, 100]
        });
        this.profileRight.Quote.Surface = new Surface({
            content: '',
            properties: {
                textAlign: "center",
                lineHeight: "20px",
                paddingTop: "10px"
            }
        });
        this.profileRight.Quote.add(this.profileRight.Quote.SizeMod).add(this.profileRight.Quote.Surface);
        this.profileRight.SeqLayout.Views.push(this.profileRight.Quote);

        // Spacer3
        this.profileRight.topSpacer4 = new Surface({
            content: '',
            size: [undefined, 20]
        });
        this.profileRight.SeqLayout.Views.push(this.profileRight.topSpacer4);


        // Edit Your Profile
        // Connect with the person (or are connected already)
        this.profileRight.Layout = new RenderController();

        // - Edit Your Profile
        this.profileRight.EditProfile = new View();
        this.profileRight.EditProfile.StateModifier = new StateModifier({
            // origin: [0, 0]
        });
        this.profileRight.EditProfile.Surface = new Surface({
            size: [undefined, 32],
            content: "EDIT YOUR PROFILE",
            properties: {
                textAlign: 'center',
                lineHeight: '32px',
                fontSize: '14px',
                color: "white",
                backgroundColor: "#07b40c",
                borderRadius: "3px"
            }
        });
        this.profileRight.EditProfile.Surface.on('click', function(){
            App.history.navigate('profile/edit');
        });
        this.profileRight.EditProfile.add(this.profileRight.EditProfile.StateModifier).add(this.profileRight.EditProfile.Surface);

        // - Connect with the person
        this.profileRight.Connect = new View();
        this.profileRight.Connect.Surface = new Surface({
            size: [undefined, 32],
            content: "Not you!",
            properties: {
                textAlign: 'center',
                lineHeight: '32px',
                fontSize: '14px',
                color: "#555",
                backgroundColor: "#f9f9f9",
                borderRadius: "3px"
            }
        });
        this.profileRight.Connect.add(this.profileRight.Connect.Surface);

        // - Connected with the person
        this.profileRight.Connected = new View();
        this.profileRight.Connected.Surface = new Surface({
            size: [undefined, 32],
            content: "You are Nemeses!",
            properties: {
                textAlign: 'center',
                lineHeight: '32px',
                fontSize: '14px',
                color: "white",
                backgroundColor: "#E87B0C",
                borderRadius: "3px"
            }
        });
        this.profileRight.Connected.add(this.profileRight.Connected.Surface);

        // this.profileRight.Layout will .show() the correct one, after the model is loaded

        this.profileRight.SeqLayout.Views.push(this.profileRight.Layout);


        // Spacer
        this.profileRight.Spacer = new Surface({
            content: '',
            size: [undefined, 1]
        });
        this.profileRight.SeqLayout.Views.push(this.profileRight.Spacer);

        this.profileRight.SeqLayout.sequenceFrom(this.profileRight.SeqLayout.Views);

        this.profileRight.add(this.profileRight.SeqLayout);
        this.profileLayout.SeqLayout.Views.push(this.profileRight);

        // Far-right spacer
        this.profileRight.SpacerFarRight = new Surface({
            content: '',
            size: [undefined, 1]
        });
        this.profileLayout.SeqLayout.Views.push(this.profileRight.SpacerFarRight);

        this.profileLayout.SeqLayout.sequenceFrom(this.profileLayout.SeqLayout.Views);

        this.contentScrollView.Views.push(this.profileLayout);


        this.ContentStateModifier = new StateModifier();

        // Content Lightbox
        // - waiting for the user to load a bit
        this.contentLightbox = new RenderController();
        this.loadingUser = new View();
        this.loadingUser.StateModifier = new StateModifier({
            origin: [0.5, 0.5]
        });
        this.loadingUser.Surface = new Surface({
            content: '<i class="icon ion-loading-c"></i>',
            size: [true, true],
            properties: {
                fontSize: "40px",
                textAlign: "center",
                color: "#444",
                lineHeight: "50px"
            }
        });
        this.loadingUser.add(this.loadingUser.StateModifier).add(this.loadingUser.Surface);
        this.contentLightbox.show(this.loadingUser);

        // this.layout.content.add(this.ContentStateModifier).add(this.mainNode);
        this.layout.content.add(this.ContentStateModifier).add(this.contentLightbox);

    };

    PageView.prototype.refreshData = function() {
        try {
            this.model.fetch();

        }catch(err){};

    };


    // Upload image to server
    PageView.prototype.uploadProfileImage = function(imageURI){
        var that = this;

        console.log('uploading...');
        console.log(this.profile_id);
        console.log({
            token : App.Data.UserToken,
            profile_id : this.profile_id,
            extra: {
                "description": "Uploaded from my phone testing 234970897"
            }
        });

        var ft = new FileTransfer(),
            options = new FileUploadOptions();

        options.fileKey = "file";
        options.fileName = 'filename.jpg'; // We will use the name auto-generated by Node at the server side.
        options.mimeType = "image/jpeg";
        options.chunkedMode = false;
        options.params = {
            token : App.Data.UserToken,
            // profile_id : this.profile_id,
            extra: {
                "description": "Uploaded from my phone testing 193246"
            }
        };

        ft.onprogress = function(progressEvent) {
            
            if (progressEvent.lengthComputable) {
                // loadingStatus.setPercentage(progressEvent.loaded / progressEvent.total);
                // console.log('Percent:');
                // console.log(progressEvent.loaded);
                // console.log(progressEvent.total);
                console.log((progressEvent.loaded / progressEvent.total) * 100);
                Utils.Notification.Toast((Math.floor((progressEvent.loaded / progressEvent.total) * 1000) / 10).toString() + '%');
            } else {
                // Not sure what is going on here...
                // loadingStatus.increment();
                console.log('not computable?, increment');
            }
        };
        ft.upload(imageURI, Credentials.server_root + "/media/profilephoto",
            function (e) {
                // getFeed();
                // alert('complete');
                // alert('upload succeeded');
                Utils.Notification.Toast('Upload succeeded');

                Utils.Notification.Toast('Refreshing');

                // update collection
                Timer.setTimeout(function(){
                    Utils.Notification.Toast('Refreshing');
                    that.model.fetch();
                },5000);

            },
            function (e) {
                alert("Upload failed");
                Utils.Notification.Toast('Upload failed');
                // Utils.Notification.Toast(e);
            }, options);
    };

    PageView.prototype.update_content = function(){
        var that = this;

        if(that.model != undefined && that.model.hasFetched){
            // pass

            // name
            if(that.model.get('profile.name')){
                this.profileLeft.ProfileName.Surface.setContent(that.model.get('profile.name'));
            }

            // Profile Photo
            if(that.model.get('profilephoto.urls')){
                that.profileLeft.ProfileImage.Surface.setContent(that.model.get('profilephoto.urls.thumb100x100'));
            } else {
                that.profileLeft.ProfileImage.Surface.setContent('img/generic-profile.png');
            }

            // username (header)
            if(that.model.get('username') !== false){
                // this.profileLeft.ProfileName.setContent(that.model.get('Profile.name'));
                that.header.navBar.title.setContent(that.model.get('username') ? that.model.get('username') : '');
            } else {
                // not me
                // - no email set
                // - not showing any name for them
                that.header.navBar.title.setContent('');
                // that.header.navBar.title.setContent(that.model.get('Profile.email') ? that.model.get('email').split('@')[0].split('+')[0] : '');
            }

            // back button and "settings" link
            if(that.is_me === true){
                // no back button
                // - show settings
                that.headerContent.Lightbox.show(that.headerContent.Settings);

            } else {
                that.header.navBar.back.setSize([20,undefined]);
                that.header.navBar.back.setContent('<i class="icon ion-android-arrow-back"></i>');
                // that.header.navBar.title.setContent(that.model.get('email').split('@')[0].split('+')[0]);
            }

        }

    };

    PageView.prototype.inOutTransition = function(direction, otherViewName, transitionOptions, delayShowing, otherView, goingBack){
        var that = this;

        this._eventOutput.emit('inOutTransition', arguments);

        switch(direction){
            case 'hiding':
                switch(otherViewName){

                    default:
                        // Overwriting and using default identity
                        transitionOptions.outTransform = Transform.identity;

                        // // Hiding the sideView
                        // this.sideView.OpacityModifier.setOpacity(0);

                        // Content
                        window.setTimeout(function(){
                            // // Fade header
                            // that.header.StateModifier.setOpacity(0, transitionOptions.outTransition);

                            // Slide left
                            that.ContentStateModifier.setTransform(Transform.translate((window.innerWidth * -1) - 100,0,0), transitionOptions.outTransition);

                        }, delayShowing);

                        break;
                }

                break;
            case 'showing':
                if(this._refreshData){
                    window.setTimeout(this.refreshData.bind(this), 1000);
                }
                this._refreshData = true;
                switch(otherViewName){

                    default:

                        // No animation by default
                        transitionOptions.inTransform = Transform.identity;

                        // // Default header opacity
                        // that.header.StateModifier.setOpacity(0);

                        // // SideView must be visible
                        // this.sideView.OpacityModifier.setOpacity(1);

                        // // Default position
                        // if(goingBack){
                        //     that.ContentStateModifier.setTransform(Transform.translate(window.innerWidth * -1,0,0));
                        // } else {
                        //     that.ContentStateModifier.setTransform(Transform.translate(window.innerWidth + 100,0,0));
                        // }
                        that.ContentStateModifier.setOpacity(0);
                        that.ContentStateModifier.setTransform(Transform.translate(0,0,0));

                        // // Header
                        // // - no extra delay
                        // window.setTimeout(function(){

                        //     // Change header opacity
                        //     that.header.StateModifier.setOpacity(1, transitionOptions.outTransition);

                        // }, delayShowing);

                        // Content
                        // - extra delay for content to be gone
                        window.setTimeout(function(){

                            // Bring map content back
                            that.ContentStateModifier.setOpacity(1, transitionOptions.inTransition);

                        }, delayShowing + transitionOptions.outTransition.duration);


                        break;
                }
                break;
        }
        
        return transitionOptions;
    };


    PageView.DEFAULT_OPTIONS = {
        header: {
            size: [undefined, 50]
        },
        footer: {
            size: [undefined, 0]
        },
        content: {
            size: [undefined, undefined],
            inTransition: true,
            outTransition: true,
            overlap: true
        }
    };

    module.exports = PageView;

});
