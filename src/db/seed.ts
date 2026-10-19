import type { Db } from './client';
import { exercises, type Equipment, type Measure } from './schema';

type SeedExercise = [slug: string, name: string, category: string, measure: Measure, equipment: Equipment | Equipment[]];

// Fixed IDs ("seed-<slug>") so the same exercises have the same ID on every device.
const SEED: SeedExercise[] = [
  // Chest
  ['bench-press', 'Supino reto', 'Peito', 'weight_reps', 'barbell'],
  ['incline-bench-press', 'Supino inclinado', 'Peito', 'weight_reps', 'barbell'],
  ['db-bench-press', 'Supino com halteres', 'Peito', 'weight_reps', 'dumbbell'],
  ['chest-fly', 'Crucifixo', 'Peito', 'weight_reps', 'dumbbell'],
  ['cable-crossover', 'Crossover', 'Peito', 'weight_reps', 'cable'],
  ['push-up', 'Flexão', 'Peito', 'reps', 'none'],
  // Back
  ['deadlift', 'Levantamento terra', 'Costas', 'weight_reps', 'barbell'],
  ['barbell-row', 'Remada curvada', 'Costas', 'weight_reps', 'barbell'],
  ['seated-row', 'Remada baixa', 'Costas', 'weight_reps', ['machine', 'cable']],
  ['lat-pulldown', 'Puxada alta', 'Costas', 'weight_reps', 'machine'],
  ['pull-up', 'Barra fixa', 'Costas', 'reps', 'other'],
  // Legs
  ['back-squat', 'Agachamento livre (back squat)', 'Pernas', 'weight_reps', 'barbell'],
  ['front-squat', 'Front squat', 'Pernas', 'weight_reps', 'barbell'],
  ['leg-press', 'Leg press', 'Pernas', 'weight_reps', 'machine'],
  ['leg-extension', 'Cadeira extensora', 'Pernas', 'weight_reps', 'machine'],
  ['leg-curl', 'Mesa flexora', 'Pernas', 'weight_reps', 'machine'],
  ['romanian-deadlift', 'Stiff', 'Pernas', 'weight_reps', 'barbell'],
  ['lunge', 'Afundo', 'Pernas', 'weight_reps', ['dumbbell', 'barbell']],
  ['calf-raise', 'Panturrilha', 'Pernas', 'weight_reps', 'machine'],
  ['hip-thrust', 'Elevação pélvica', 'Pernas', 'weight_reps', 'barbell'],
  // Shoulders
  ['overhead-press', 'Desenvolvimento', 'Ombros', 'weight_reps', ['barbell', 'dumbbell', 'machine']],
  ['lateral-raise', 'Elevação lateral', 'Ombros', 'weight_reps', ['dumbbell', 'cable']],
  ['front-raise', 'Elevação frontal', 'Ombros', 'weight_reps', ['dumbbell', 'cable']],
  ['face-pull', 'Face pull', 'Ombros', 'weight_reps', 'cable'],
  ['external-rotation', 'Rotação externa', 'Ombros', 'weight_reps', 'cable'],
  ['internal-rotation', 'Rotação interna', 'Ombros', 'weight_reps', 'cable'],
  // Arms
  ['barbell-curl', 'Rosca direta', 'Braços', 'weight_reps', ['barbell', 'dumbbell', 'cable']],
  ['hammer-curl', 'Rosca martelo', 'Braços', 'weight_reps', 'dumbbell'],
  ['triceps-pushdown', 'Tríceps pulley', 'Braços', 'weight_reps', 'cable'],
  ['skull-crusher', 'Tríceps testa', 'Braços', 'weight_reps', ['barbell', 'dumbbell']],
  ['dip', 'Paralelas (dip)', 'Braços', 'reps', 'other'],
  // Core
  ['plank', 'Prancha', 'Core', 'time', 'none'],
  ['crunch', 'Abdominal', 'Core', 'reps', 'none'],
  ['sit-up', 'Sit-up', 'Core', 'reps', 'none'],
  ['toes-to-bar', 'Toes to bar', 'Core', 'reps', 'other'],
  ['ghd-sit-up', 'GHD sit-up', 'Core', 'reps', 'other'],
  // Olympic lifting / weighted CrossFit
  ['clean', 'Clean', 'LPO', 'weight_reps', 'barbell'],
  ['power-clean', 'Power clean', 'LPO', 'weight_reps', 'barbell'],
  ['squat-clean', 'Squat clean', 'LPO', 'weight_reps', 'barbell'],
  ['clean-and-jerk', 'Clean and jerk', 'LPO', 'weight_reps', 'barbell'],
  ['snatch', 'Snatch', 'LPO', 'weight_reps', 'barbell'],
  ['power-snatch', 'Power snatch', 'LPO', 'weight_reps', 'barbell'],
  ['push-press', 'Push press', 'LPO', 'weight_reps', 'barbell'],
  ['push-jerk', 'Push jerk', 'LPO', 'weight_reps', 'barbell'],
  ['thruster', 'Thruster', 'Crossfit', 'weight_reps', 'barbell'],
  ['overhead-squat', 'Overhead squat', 'Crossfit', 'weight_reps', 'barbell'],
  ['kettlebell-swing', 'Kettlebell swing', 'Crossfit', 'weight_reps', 'kettlebell'],
  ['wall-ball', 'Wall ball', 'Crossfit', 'weight_reps', 'other'],
  ['db-snatch', 'Dumbbell snatch', 'Crossfit', 'weight_reps', 'dumbbell'],
  ['sumo-deadlift-high-pull', 'Sumo deadlift high pull', 'Crossfit', 'weight_reps', 'barbell'],
  // Gymnastics
  ['burpee', 'Burpee', 'Ginástica', 'reps', 'none'],
  ['bar-muscle-up', 'Bar muscle-up', 'Ginástica', 'reps', 'other'],
  ['ring-muscle-up', 'Ring muscle-up', 'Ginástica', 'reps', 'other'],
  ['chest-to-bar', 'Chest to bar', 'Ginástica', 'reps', 'other'],
  ['handstand-push-up', 'Handstand push-up', 'Ginástica', 'reps', 'none'],
  ['pistol', 'Pistol', 'Ginástica', 'reps', 'none'],
  ['box-jump', 'Box jump', 'Ginástica', 'reps', 'other'],
  ['air-squat', 'Air squat', 'Ginástica', 'reps', 'none'],
  ['double-under', 'Double under', 'Ginástica', 'reps', 'other'],
  ['rope-climb', 'Subida na corda', 'Ginástica', 'reps', 'other'],
  ['handstand-walk', 'Handstand walk', 'Ginástica', 'distance', 'none'],
  // Cardio / monostructural
  ['row-cal', 'Remo (cal)', 'Cardio', 'calories', 'machine'],
  ['row-distance', 'Remo (distância)', 'Cardio', 'distance', 'machine'],
  ['bike-cal', 'Assault bike (cal)', 'Cardio', 'calories', 'machine'],
  ['ski-erg-cal', 'Ski erg (cal)', 'Cardio', 'calories', 'machine'],
  ['run', 'Corrida', 'Cardio', 'distance', 'none'],
];

export async function seedExercises(db: Db) {
  const now = Date.now();
  await db
    .insert(exercises)
    .values(
      SEED.map(([slug, name, category, measure, equipment]) => ({
        id: `seed-${slug}`,
        name,
        category,
        measure,
        equipment: Array.isArray(equipment) ? equipment : [equipment],
        isCustom: false,
        createdAt: now,
        updatedAt: now,
        dirty: false,
      })),
    )
    .onConflictDoNothing();
}
