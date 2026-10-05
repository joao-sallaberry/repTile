import type { Db } from './client';
import { exercises, type Measure } from './schema';

type SeedExercise = [slug: string, name: string, category: string, measure: Measure];

// Fixed IDs ("seed-<slug>") so the same exercises have the same ID on every device.
const SEED: SeedExercise[] = [
  // Chest
  ['bench-press', 'Supino reto', 'Peito', 'weight_reps'],
  ['incline-bench-press', 'Supino inclinado', 'Peito', 'weight_reps'],
  ['db-bench-press', 'Supino com halteres', 'Peito', 'weight_reps'],
  ['chest-fly', 'Crucifixo', 'Peito', 'weight_reps'],
  ['cable-crossover', 'Crossover', 'Peito', 'weight_reps'],
  ['push-up', 'Flexão', 'Peito', 'reps'],
  // Back
  ['deadlift', 'Levantamento terra', 'Costas', 'weight_reps'],
  ['barbell-row', 'Remada curvada', 'Costas', 'weight_reps'],
  ['seated-row', 'Remada baixa', 'Costas', 'weight_reps'],
  ['lat-pulldown', 'Puxada alta', 'Costas', 'weight_reps'],
  ['pull-up', 'Barra fixa', 'Costas', 'reps'],
  // Legs
  ['back-squat', 'Agachamento livre (back squat)', 'Pernas', 'weight_reps'],
  ['front-squat', 'Front squat', 'Pernas', 'weight_reps'],
  ['leg-press', 'Leg press', 'Pernas', 'weight_reps'],
  ['leg-extension', 'Cadeira extensora', 'Pernas', 'weight_reps'],
  ['leg-curl', 'Mesa flexora', 'Pernas', 'weight_reps'],
  ['romanian-deadlift', 'Stiff', 'Pernas', 'weight_reps'],
  ['lunge', 'Afundo', 'Pernas', 'weight_reps'],
  ['calf-raise', 'Panturrilha', 'Pernas', 'weight_reps'],
  ['hip-thrust', 'Elevação pélvica', 'Pernas', 'weight_reps'],
  // Shoulders
  ['overhead-press', 'Desenvolvimento', 'Ombros', 'weight_reps'],
  ['lateral-raise', 'Elevação lateral', 'Ombros', 'weight_reps'],
  ['front-raise', 'Elevação frontal', 'Ombros', 'weight_reps'],
  ['face-pull', 'Face pull', 'Ombros', 'weight_reps'],
  // Arms
  ['barbell-curl', 'Rosca direta', 'Braços', 'weight_reps'],
  ['hammer-curl', 'Rosca martelo', 'Braços', 'weight_reps'],
  ['triceps-pushdown', 'Tríceps pulley', 'Braços', 'weight_reps'],
  ['skull-crusher', 'Tríceps testa', 'Braços', 'weight_reps'],
  ['dip', 'Paralelas (dip)', 'Braços', 'reps'],
  // Core
  ['plank', 'Prancha', 'Core', 'time'],
  ['crunch', 'Abdominal', 'Core', 'reps'],
  ['sit-up', 'Sit-up', 'Core', 'reps'],
  ['toes-to-bar', 'Toes to bar', 'Core', 'reps'],
  ['ghd-sit-up', 'GHD sit-up', 'Core', 'reps'],
  // Olympic lifting / weighted CrossFit
  ['clean', 'Clean', 'LPO', 'weight_reps'],
  ['power-clean', 'Power clean', 'LPO', 'weight_reps'],
  ['squat-clean', 'Squat clean', 'LPO', 'weight_reps'],
  ['clean-and-jerk', 'Clean and jerk', 'LPO', 'weight_reps'],
  ['snatch', 'Snatch', 'LPO', 'weight_reps'],
  ['power-snatch', 'Power snatch', 'LPO', 'weight_reps'],
  ['push-press', 'Push press', 'LPO', 'weight_reps'],
  ['push-jerk', 'Push jerk', 'LPO', 'weight_reps'],
  ['thruster', 'Thruster', 'Crossfit', 'weight_reps'],
  ['overhead-squat', 'Overhead squat', 'Crossfit', 'weight_reps'],
  ['kettlebell-swing', 'Kettlebell swing', 'Crossfit', 'weight_reps'],
  ['wall-ball', 'Wall ball', 'Crossfit', 'weight_reps'],
  ['db-snatch', 'Dumbbell snatch', 'Crossfit', 'weight_reps'],
  ['sumo-deadlift-high-pull', 'Sumo deadlift high pull', 'Crossfit', 'weight_reps'],
  // Gymnastics
  ['burpee', 'Burpee', 'Ginástica', 'reps'],
  ['bar-muscle-up', 'Bar muscle-up', 'Ginástica', 'reps'],
  ['ring-muscle-up', 'Ring muscle-up', 'Ginástica', 'reps'],
  ['chest-to-bar', 'Chest to bar', 'Ginástica', 'reps'],
  ['handstand-push-up', 'Handstand push-up', 'Ginástica', 'reps'],
  ['pistol', 'Pistol', 'Ginástica', 'reps'],
  ['box-jump', 'Box jump', 'Ginástica', 'reps'],
  ['air-squat', 'Air squat', 'Ginástica', 'reps'],
  ['double-under', 'Double under', 'Ginástica', 'reps'],
  ['rope-climb', 'Subida na corda', 'Ginástica', 'reps'],
  ['handstand-walk', 'Handstand walk', 'Ginástica', 'distance'],
  // Cardio / monostructural
  ['row-cal', 'Remo (cal)', 'Cardio', 'calories'],
  ['row-distance', 'Remo (distância)', 'Cardio', 'distance'],
  ['bike-cal', 'Assault bike (cal)', 'Cardio', 'calories'],
  ['ski-erg-cal', 'Ski erg (cal)', 'Cardio', 'calories'],
  ['run', 'Corrida', 'Cardio', 'distance'],
];

export async function seedExercises(db: Db) {
  const now = Date.now();
  await db
    .insert(exercises)
    .values(
      SEED.map(([slug, name, category, measure]) => ({
        id: `seed-${slug}`,
        name,
        category,
        measure,
        isCustom: false,
        createdAt: now,
        updatedAt: now,
        dirty: false,
      })),
    )
    .onConflictDoNothing();
}
