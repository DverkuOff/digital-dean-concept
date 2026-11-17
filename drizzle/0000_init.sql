CREATE TYPE "public"."attempt_kind" AS ENUM('main', 'retake1', 'retake2', 'commission');--> statement-breakpoint
CREATE TYPE "public"."attempt_result" AS ENUM('failed', 'passed', 'scheduled', 'absent');--> statement-breakpoint
CREATE TYPE "public"."control_type" AS ENUM('exam', 'diff_credit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."grade_status" AS ENUM('open', 'passed', 'debt');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('normal', 'moved', 'room_changed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('lecture', 'seminar', 'language');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('schedule', 'deadline', 'request', 'retake', 'grade');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('submitted', 'in_progress', 'returned', 'ready', 'done', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'staff');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discipline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"credits" real NOT NULL,
	"control_type" "control_type" NOT NULL,
	"semester" integer NOT NULL,
	"teacher" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dismissed_card" (
	"student_id" uuid NOT NULL,
	"card_key" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissed_card_student_id_card_key_pk" PRIMARY KEY("student_id","card_key")
);
--> statement-breakpoint
CREATE TABLE "exam_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"kind" "attempt_kind" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"room" text,
	"score" integer,
	"result" "attempt_result" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"slice1" integer,
	"slice2" integer,
	"slice3" integer,
	"final_score" integer,
	"status" "grade_status" NOT NULL,
	"passed_on_retake" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"discipline_id" uuid NOT NULL,
	"type" "lesson_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"room" text NOT NULL,
	"teacher" text NOT NULL,
	"status" "lesson_status" DEFAULT 'normal' NOT NULL,
	"original_starts_at" timestamp with time zone,
	"original_room" text,
	"change_note" text,
	"changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"faculty" text,
	"important" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"student_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" "request_status" DEFAULT 'submitted' NOT NULL,
	"payload" jsonb NOT NULL,
	"return_reason" text,
	"return_field" text,
	"staff_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "request_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "request_status" NOT NULL,
	"comment" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"faculty" text NOT NULL,
	"program" text NOT NULL,
	"course" integer NOT NULL,
	"group_code" text NOT NULL,
	"cohort" text NOT NULL,
	"funding_type" text DEFAULT 'бюджет' NOT NULL,
	"record_book" text NOT NULL,
	CONSTRAINT "student_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" "role" DEFAULT 'student' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_card" ADD CONSTRAINT "dismissed_card_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_discipline_id_discipline_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."discipline"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_discipline_id_discipline_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."discipline"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_discipline_id_discipline_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."discipline"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempt_student_idx" ON "exam_attempt" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "grade_student_idx" ON "grade" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_student_discipline_uq" ON "grade" USING btree ("student_id","discipline_id");--> statement-breakpoint
CREATE INDEX "lesson_group_time_idx" ON "lesson" USING btree ("group_code","starts_at");--> statement-breakpoint
CREATE INDEX "notification_student_idx" ON "notification" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "request_student_idx" ON "request" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "request_status_idx" ON "request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "request_event_request_idx" ON "request_event" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_cohort_idx" ON "student" USING btree ("cohort");--> statement-breakpoint
CREATE INDEX "student_group_idx" ON "student" USING btree ("group_code");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");