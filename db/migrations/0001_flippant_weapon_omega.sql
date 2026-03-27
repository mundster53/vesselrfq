CREATE TABLE "nozzles" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer NOT NULL,
	"mark" text NOT NULL,
	"size" text NOT NULL,
	"rating" text NOT NULL,
	"flange_type" text NOT NULL,
	"facing" text NOT NULL,
	"material" text NOT NULL,
	"service" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"location" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"shell_od" numeric,
	"shell_length" numeric,
	"shell_material" text,
	"head_type" text,
	"mawp" numeric,
	"design_temp" integer,
	"corrosion_allowance" numeric,
	"support_type" text,
	"saddle_height" numeric,
	"saddle_width" numeric,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'buyer';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "nozzles" ADD CONSTRAINT "nozzles_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;