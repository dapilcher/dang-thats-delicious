const mongoose = require("mongoose");
const slug = require("slugs");

mongoose.Promise = global.Promise;

const storeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			trim: true,
			required: "Please enter a store name"
		},
		slug: String,
		description: {
			type: String,
			trim: true
		},
		tags: [String],
		created: {
			type: Date,
			default: Date.now
		},
		location: {
			type: {
				type: String,
				default: "Point"
			},
			coordinates: [
				{
					type: Number,
					required: "You must supply coordinates"
				}
			],
			address: {
				type: String,
				required: "You must supply an address"
			}
		},
		photo: String,
		author: {
			type: mongoose.Schema.ObjectId,
			ref: "User",
			required: "You must supply an author"
		}
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true }
	}
);

// Define our indexes
storeSchema.index({
	name: "text",
	description: "text"
});

storeSchema.index({
	location: "2dsphere"
});

storeSchema.pre("save", async function(next) {
	if (!this.isModified("name")) {
		next(); //skip it
		return; //stop function from running
	}
	this.slug = slug(this.name);

	// make sure slugs are unique
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
	const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
	if (storesWithSlug.length) {
		this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
	}

	next();
});

storeSchema.statics.getTagsList = function() {
	return this.aggregate([
		{ $unwind: "$tags" },
		{
			$group: {
				_id: "$tags",
				count: { $sum: 1 }
			}
		},
		{ $sort: { count: -1 } }
	]);
};

storeSchema.statics.getTopStores = function() {
	return this.aggregate([
		// Lookup stores and populate their reviews
		{
			$lookup: {
				from: "reviews",
				localField: "_id",
				foreignField: "store",
				as: "reviews"
			}
		},
		// filter for items that have 2 or more reviews
		{
			$match: {
				"reviews.1": { $exists: true }
			}
		},
		// Add average reviews field
		{
			$project: {
				photo: "$$ROOT.photo",
				name: "$$ROOT.name",
				reviews: "$$ROOT.reviews",
				slug: "$$ROOT.slug",
				averageRating: { $avg: "$reviews.rating" }
			}
		},
		// sort by new field, highest first
		{ $sort: { averageRating: -1 } },
		// limit to 10
		{ $limit: 10 }
	]);
};

// find reviews where the Store's _id property === Review's store property
storeSchema.virtual("reviews", {
	ref: "Review", // what model to link?
	localField: "_id", // which field on the store?
	foreignField: "store" // which field on the review?
});

function autopopulate(next) {
	this.populate("reviews");
	next();
}

storeSchema.pre("find", autopopulate);
storeSchema.pre("findOne", autopopulate);

module.exports = mongoose.model("Store", storeSchema);
