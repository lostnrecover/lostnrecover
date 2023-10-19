

export async function initCollection(db, collectionName, indexes) {
	let collection, colInfo = await db.listCollections({ name: collectionName}).toArray();
	if(colInfo.length > 0) {
		collection = db.collection(collectionName);
	} else {
		collection = await db.createCollection(collectionName);
	}
	// collection exists
	if(indexes) {
		indexes.forEach(index => {
			// index.spec, index.options
			collection.indexExists(index.options.name).then(exists => {
				if (!exists) {
					collection.createIndex(index.spec, index.options);
				}
			});
		});
	}
	return collection;
}
