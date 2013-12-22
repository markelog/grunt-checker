"use stirct";

var path = require( "path" ),
    utils = require( "util" ),

    Checker = require( "jscs/lib/checker" ),

    assign = require( "lodash.assign" ),
    hooker = require( "hooker" );

exports.init = function( grunt ) {

    // Task specific options
    var taskOptions = [ "config", "force", "reporter", "reporterOutput" ];

    /**
     * @see jQuery.isEmptyObject
     * @private
     */
    function isEmptyObject( obj ) {
      var name;

      for ( name in obj ) {
        return false;
      }

      return true;
    }

    /**
     * Default reporter
     * @private
     * @param {errorsCollection} errorsCollection
     */
    function defaultReporter( errorsCollection ) {
        errorsCollection.forEach(function( errors ) {
            if ( !errors.isEmpty() ) {
                errors.getErrorList().forEach(function( error ) {
                    grunt.log.writeln( errors.explainError( error, true ) );
                });
            }
        });
    }

    /**
     * Create new instance of jscs Checker module
     * @constructor
     * @param {Object} options
     * @return {JSCS}
     */
    function JSCS( options ) {
        this.checker = new Checker();
        this.options = options;

        this.checker.registerDefaultRules();
        this.checker.configure( this.getConfig() );

        this._reporter = this.registerReporter( options.reporter );
    }

    /**
     * @see Checker#checkPath
     */
    JSCS.prototype.check = function( path ) {
        var checkPath = this.checker.checkPath( path );

        checkPath.fail(function( error ) {
            grunt.warn( error );
        });

        return checkPath;
    }

    /**
     * Get config
     * @return {Object}
     */
    JSCS.prototype.getConfig = function() {
        var filePath = this.options.config,
            config = this.findConfig(),
            options = this.getOptions();

        assign( config, options );

        if ( isEmptyObject( config ) ) {
            if ( filePath && !grunt.file.exists( filePath ) ) {
                grunt.fatal( "The config file \"" + filePath + "\" was not found" );

            } else if ( filePath ) {
                grunt.fatal( "\"" + filePath + "\" is empty" );

            } else {
                grunt.fatal( "Nor config file nor inline options weren't found" );
            }
        }

        return config;
    }

    /**
     * Read config file
     * @return {Object}
     */
     JSCS.prototype.findConfig = function() {
        var configPath = this.options && this.options.config || ".jscs.json";

        if ( !grunt.file.isPathAbsolute( configPath ) ) {
            configPath = path.join( process.cwd(), configPath );
        }

        if ( grunt.file.exists( configPath ) ) {
            return grunt.file.readJSON( configPath );
        }

        return {};
    }

    /**
     * Get inline options
     * @return {Object}
     */
    JSCS.prototype.getOptions = function() {
        var _options = {};

        // Copy options to another object so this method would not be destructive
        for ( var option in this.options ) {

            // If to jscs would be given a grunt task option
            // that not defined in jscs it would throw
            if ( !~taskOptions.indexOf( option ) ) {
                _options[ option ] = this.options[ option ]
            }
        }

        return _options;
    }

    /**
     * Register reporter
     * @param {String} name - name or path to the reporter
     * @return {Reporter}
     */
    JSCS.prototype.registerReporter = function( name ) {
        if ( !name ) {
            return defaultReporter;
        }

        var module;

        try {
            module = require( "jscs/lib/reporters/" + name );
        } catch ( _ ) {
            try {
                module = require( path.resolve( process.cwd(), name ) );
            } catch ( _ ) {}
        }

        if ( module ) {
            return module;
        }

        grunt.fatal( "Reporter \"" + name + "\" does not exist" );
    },

    /**
     * Return reporter
     * @return {Reporter}
     */
    JSCS.prototype.getReporter = function() {
        return this._reporter;
    }

    /**
     * Set errors collection as instance property
     * @param {errorsCollection} errorsCollection
     * @return {Number}
     */
    JSCS.prototype.setErrors = function( errorsCollection ) {
        this._errors = errorsCollection;

        return this;
    }

    /**
     * Count and return errors
     * @param {errorsCollection} [errorsCollection]
     * @return {Number}
     */
    JSCS.prototype.count = function( errorsCollection ) {
        var result = 0;

        ( errorsCollection || this._errors ).forEach(function( errors ) {
            result += errors.getErrorCount();
        });

        return result;
    }

    /**
     * Send errors to the reporter
     * @param {errorsCollection} [errorsCollection]
     * @return {JSCS}
     */
    JSCS.prototype.report = function( errorsCollection ) {
        var options = this.options,
            shouldHook = options.reporter && options.reporterOutput;

        if ( shouldHook ) {
            hooker.hook( process.stdout, "write", {
                pre: function( out ) {
                    grunt.file.write( options.reporterOutput, out );

                    return hooker.preempt();
                }
            });
        }

        this._result = this._reporter( errorsCollection || this._errors );

        if ( shouldHook ) {
            hooker.unhook( process.stdout, "write" );
        }

        return this;
    }

    /**
     * Print number of found errors
     * @param {errorsCollection} [errorsCollection]
     * @return {JSCS}
     */
    JSCS.prototype.notify = function( errorsCollection ) {
        errorsCollection = errorsCollection || this._errors;

        var errorCount = this.count( errorsCollection );

        if ( errorCount ) {
            grunt.log.error( errorCount + " code style errors found!" );

        } else {
            grunt.log.ok( errorsCollection.length + " files without code style errors." );
        }

        return this;
    }

    return JSCS;
}
