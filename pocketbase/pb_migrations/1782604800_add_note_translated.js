/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const ids = ["pbc_2035508808", "pbc_2186768164"]; // booking_notes, client_preferences
  const fieldIds = {
    pbc_2035508808: "text9900000011",
    pbc_2186768164: "text9900000012",
  };
  ids.forEach((id) => {
    const collection = app.findCollectionByNameOrId(id);
    collection.fields.add(
      new Field({
        autogeneratePattern: "",
        hidden: false,
        id: fieldIds[id],
        max: 2000,
        min: 0,
        name: "note_translated",
        pattern: "",
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: "text",
      }),
    );
    app.save(collection);
  });
}, (app) => {
  const ids = ["pbc_2035508808", "pbc_2186768164"];
  ids.forEach((id) => {
    const collection = app.findCollectionByNameOrId(id);
    const field = collection.fields.getByName("note_translated");
    if (field) {
      collection.fields.removeById(field.id);
      app.save(collection);
    }
  });
});
