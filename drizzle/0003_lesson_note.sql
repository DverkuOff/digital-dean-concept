CREATE TABLE "lesson_note" (
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_note_student_id_lesson_id_pk" PRIMARY KEY("student_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_note" ADD CONSTRAINT "lesson_note_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_note" ADD CONSTRAINT "lesson_note_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;