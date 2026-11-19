// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_locations_machines_set_types.sql';
import m0002 from './0002_machine_photo.sql';
import m0003 from './0003_personal_records.sql';
import m0004 from './0004_blocks.sql';
import m0005 from './0005_exercise_equipment.sql';
import m0006 from './0006_tabata_splits.sql';
import m0007 from './0007_delete_orphan_sets.sql';
import m0008 from './0008_cable_equipment.sql';
import m0009 from './0009_multi_equipment.sql';
import m0010 from './0010_merge_exercises.sql';
import m0011 from './0011_lunge_equipment.sql';
import m0012 from './0012_location_variants.sql';
import m0013 from './0013_session_health.sql';
import m0014 from './0014_thruster_equipment.sql';
import m0015 from './0015_session_origin.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013,
m0014,
m0015
    }
  }
  