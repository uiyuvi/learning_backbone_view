/*jshint expr:true eqnull:true */
/*jshint camelcase:false */
/**
 *
 * Backbone.DeepModel v0.10.4
 *
 * Copyright (c) 2013 Charles Davison, Pow Media Ltd
 *
 * https://github.com/powmedia/backbone-deep-model
 * Licensed under the MIT License
 */

/**
 * Main source
 */

;(function(factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD
		define(['underscore-deepExtend', 'backbone'], factory);
	} else {
		// globals
		factory(_, Backbone);
	}
}(function(_, Backbone) {

	/**
	 * Takes a nested object and returns a shallow object keyed with the path names
	 * e.g. { "level1.level2": "value" }
	 *
	 * @param  {Object}      Nested object e.g. { level1: { level2: 'value' } }
	 * @return {Object}      Shallow object with path names e.g. { 'level1.level2': 'value' }
	 */
	function objToPaths(obj) {
		var ret = {},
			 separator = DeepModel.keyPathSeparator;

		for (var key in obj) {
			var val = obj[key];

			if (val && val.constructor === Object && !_.isEmpty(val)) {
				//Recursion for embedded objects
				var obj2 = objToPaths(val);

				for (var key2 in obj2) {
					var val2 = obj2[key2];

					ret[key + separator + key2] = val2;
				}
			} else {
				ret[key] = val;
			}
		}

		return ret;
	}

	/**
	 * @param {Object}  Object to fetch attribute from
	 * @param {String}  Object path e.g. 'user.name'
	 * @return {Mixed}
	 */
	function getNested(obj, path, return_exists) {
		var separator = DeepModel.keyPathSeparator;

		var fields = path.split(separator);
		var result = obj;
		return_exists || (return_exists === false);
		for (var i = 0, n = fields.length; i < n; i++) {
			if (return_exists && !_.has(result, fields[i])) {
				return false;
			}
			result = result[fields[i]];

			if (result == null && i < n - 1) {
				result = {};
			}

			if (typeof result === 'undefined') {
				if (return_exists)
				{
					return true;
				}
				return result;
			}
		}
		if (return_exists)
		{
			return true;
		}
		return result;
	}

	/**
	 * @param {Object} obj                Object to fetch attribute from
	 * @param {String} path               Object path e.g. 'user.name'
	 * @param {Object} [options]          Options
	 * @param {Boolean} [options.unset]   Whether to delete the value
	 * @param {Mixed}                     Value to set
	 */
	function setNested(obj, path, val, options) {
		options = options || {};

		var separator = DeepModel.keyPathSeparator;

		var fields = path.split(separator);
		var result = obj;
		for (var i = 0, n = fields.length; i < n && result !== undefined ; i++) {
			var field = fields[i];

			//If the last in the path, set the value
			if (i === n - 1) {
				options.unset ? delete result[field] : result[field] = val;
			} else {
				//Create the child object if it doesn't exist, or isn't an object
				if (typeof result[field] === 'undefined' || ! _.isObject(result[field])) {
					result[field] = {};
				}

				//Move onto the next part of the path
				result = result[field];
			}
		}
	}

	function deleteNested(obj, path) {
		setNested(obj, path, null, { unset: true });
	}

	var DeepModel = Backbone.Model.extend({

		// Override constructor
		// Support having nested defaults by using _.deepExtend instead of _.extend
		constructor: function(attributes, options) {
			var defaults;
			var attrs = attributes || {};
			this.cid = _.uniqueId('c');
			this.attributes = {};
			if (options && options.collection) this.collection = options.collection;
			if (options && options.parse) attrs = this.parse(attrs, options) || {};
			if (defaults = _.result(this, 'defaults')) {
				//<custom code>
				// Replaced the call to _.defaults with _.deepExtend.
				attrs = _.deepExtend({}, defaults, attrs);
				//</custom code>
			}
			this.set(attrs, options);
			this.changed = {};
			this.initialize.apply(this, arguments);
		},

		// Return a copy of the model's `attributes` object.
		toJSON: function(options) {
			return _.deepClone(this.attributes);
		},

		// Override get
		// Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
		get: function(attr) {
			return getNested(this.attributes, attr);
		},

		// Override set
		// Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
		set: function(key, val, options) {
			var attr, attrs, unset, changes, silent, changing, prev, current;
			if (key == null) return this;

			// Handle both `"key", value` and `{key: value}` -style arguments.
			if (typeof key === 'object') {
				attrs = key;
				options = val || {};
			} else {
				(attrs = {})[key] = val;
			}

			options || (options = {});

			// Run validation.
			if (!this._validate(attrs, options)) return false;

			// Extract attributes and options.
			unset           = options.unset;
			silent          = options.silent;
			changes         = [];
			changing        = this._changing;
			this._changing  = true;

			if (!changing) {
				this._previousAttributes = _.deepClone(this.attributes); //<custom>: Replaced _.clone with _.deepClone
				this.changed = {};
			}
			current = this.attributes, prev = this._previousAttributes;

			// Check for changes of `id`.
			if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

			//<custom code>
			attrs = objToPaths(attrs);
			//</custom code>

			// For each `set` attribute, update or delete the current value.
			for (attr in attrs) {
				val = attrs[attr];

				//<custom code>: Using getNested, setNested and deleteNested
				if (!_.isEqual(getNested(current, attr), val)) changes.push(attr);
				if (!_.isEqual(getNested(prev, attr), val)) {
					setNested(this.changed, attr, val);
				} else {
					deleteNested(this.changed, attr);
				}
				unset ? deleteNested(current, attr) : setNested(current, attr, val);
				//</custom code>
			}

			// Trigger all relevant attribute changes.
			if (!silent) {
				if (changes.length) this._pending = true;

				//<custom code>
				var separator = DeepModel.keyPathSeparator;

				for (var i = 0, l = changes.length; i < l; i++) {
					var key = changes[i];

					this.trigger('change:' + key, this, getNested(current, key), options);

					var fields = key.split(separator);

					//Trigger change events for parent keys with wildcard (*) notation
					for(var n = fields.length - 1; n > 0; n--) {
						var parentKey = _.first(fields, n).join(separator),
							 wildcardKey = parentKey + separator + '*';

						this.trigger('change:' + wildcardKey, this, getNested(current, parentKey), options);
					}
					//</custom code>
				}
			}

			if (changing) return this;
			if (!silent) {
				while (this._pending) {
					this._pending = false;
					this.trigger('change', this, options);
				}
			}
			this._pending = false;
			this._changing = false;
			return this;
		},

		// Clear all attributes on the model, firing `"change"` unless you choose
		// to silence it.
		clear: function(options) {
			var attrs = {};
			var shallowAttributes = objToPaths(this.attributes);
			for (var key in shallowAttributes) attrs[key] = void 0;
			return this.set(attrs, _.extend({}, options, {unset: true}));
		},

		// Determine if the model has changed since the last `"change"` event.
		// If you specify an attribute name, determine if that attribute has changed.
		hasChanged: function(attr) {
			if (attr == null) return !_.isEmpty(this.changed);
			return getNested(this.changed, attr) !== undefined;
		},

		// Return an object containing all the attributes that have changed, or
		// false if there are no changed attributes. Useful for determining what
		// parts of a view need to be updated and/or what attributes need to be
		// persisted to the server. Unset attributes will be set to undefined.
		// You can also pass an attributes object to diff against the model,
		// determining if there *would be* a change.
		changedAttributes: function(diff) {
			//<custom code>: objToPaths
			if (!diff) return this.hasChanged() ? objToPaths(this.changed) : false;
			//</custom code>

			var old = this._changing ? this._previousAttributes : this.attributes;

			//<custom code>
			diff = objToPaths(diff);
			old = objToPaths(old);
			//</custom code>

			var val, changed = false;
			for (var attr in diff) {
				if (_.isEqual(old[attr], (val = diff[attr]))) continue;
				(changed || (changed = {}))[attr] = val;
			}
			return changed;
		},

		// Get the previous value of an attribute, recorded at the time the last
		// `"change"` event was fired.
		previous: function(attr) {
			if (attr == null || !this._previousAttributes) return null;

			//<custom code>
			return getNested(this._previousAttributes, attr);
			//</custom code>
		},

		// Get all of the attributes of the model at the time of the previous
		// `"change"` event.
		previousAttributes: function() {
			//<custom code>
			return _.deepClone(this._previousAttributes);
			//</custom code>
		}
	});


	//Config; override in your app to customise
	DeepModel.keyPathSeparator = '.';


	//Exports
	Backbone.DeepModel = DeepModel;

	//For use in NodeJS
	if (typeof module != 'undefined') module.exports = DeepModel;

	return Backbone;

}));

