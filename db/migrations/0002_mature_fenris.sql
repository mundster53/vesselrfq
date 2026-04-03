CREATE TABLE "fabricator_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop_name" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"stamps" text[] NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"website" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fabricator_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "vessel_type" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tema_front_head" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tema_shell" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tema_rear_head" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "hx_orientation" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shells_in_series" integer;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shells_in_parallel" integer;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_count" integer;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_od" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_bwg" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_length" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_material" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_layout" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_pitch" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_joint" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "baffle_type" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "baffle_cut" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "baffle_spacing" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "impingement_plate" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shell_side_pressure" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shell_side_temp" integer;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shell_side_ca" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "shell_side_fluid" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_side_pressure" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_side_temp" integer;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_side_ca" numeric;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "tube_side_fluid" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "fabricator_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "fabricator_profiles" ADD CONSTRAINT "fabricator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;