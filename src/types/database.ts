export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SemesterRecord = {
  id: string;
  user_id: string;
  name: string;
  academic_year: string | null;
  term: string | null;
  created_at: string;
};

export type CourseRecord = {
  id: string;
  user_id: string;
  semester_id: string;
  name: string;
  code: string | null;
  credit_hours: number;
  created_at: string;
};

export type AssessmentRecord = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  weight: number;
  score: number | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      semesters: {
        Row: SemesterRecord;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          academic_year?: string | null;
          term?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<SemesterRecord, "id" | "created_at">>;
        Relationships: [];
      };
      courses: {
        Row: CourseRecord;
        Insert: {
          id?: string;
          user_id: string;
          semester_id: string;
          name: string;
          code?: string | null;
          credit_hours?: number;
          created_at?: string;
        };
        Update: Partial<Omit<CourseRecord, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "courses_semester_id_fkey";
            columns: ["semester_id"];
            isOneToOne: false;
            referencedRelation: "semesters";
            referencedColumns: ["id"];
          }
        ];
      };
      assessments: {
        Row: AssessmentRecord;
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          title: string;
          weight?: number;
          score?: number | null;
          created_at?: string;
        };
        Update: Partial<Omit<AssessmentRecord, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CourseWithAssessments = CourseRecord & {
  assessments: AssessmentRecord[];
};
