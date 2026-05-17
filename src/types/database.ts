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
  name: string | null;
  weight_percentage: number | null;
  score: number | null;
  max_score: number | null;
  category: string | null;
  created_at: string;
  title?: string | null;
  weight?: number | null;
};

export type SyllabusUploadRecord = {
  id: string;
  user_id: string;
  course_id: string;
  file_path: string;
  original_filename: string;
  status: string;
  extraction: Json | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseTemplateRecord = {
  id: string;
  course_code: string;
  course_name: string;
  department: string | null;
  credit_hours: number;
  instructor: string | null;
  term: string | null;
  description: string | null;
  source_file_name: string | null;
  source_folder_path: string | null;
  source_syllabus_file_name: string | null;
  source_syllabus_path: string | null;
  extraction_confidence: number;
  created_at: string;
  updated_at: string;
};

export type CourseTemplateAssessmentRecord = {
  id: string;
  course_template_id: string;
  name: string;
  weight_percentage: number;
  max_score: number;
  confidence: number;
  source_text_snippet: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseTemplateMaterialRecord = {
  id: string;
  course_template_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  material_type: string | null;
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
          name: string;
          weight_percentage?: number;
          score?: number | null;
          max_score?: number | null;
          category?: string | null;
          title?: string | null;
          weight?: number | null;
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
      syllabus_uploads: {
        Row: SyllabusUploadRecord;
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          file_path: string;
          original_filename: string;
          status?: string;
          extraction?: Json | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<SyllabusUploadRecord, "id" | "created_at" | "updated_at">
        >;
        Relationships: [
          {
            foreignKeyName: "syllabus_uploads_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          }
        ];
      };
      course_templates: {
        Row: CourseTemplateRecord;
        Insert: {
          id?: string;
          course_code: string;
          course_name: string;
          department?: string | null;
          credit_hours?: number;
          instructor?: string | null;
          term?: string | null;
          description?: string | null;
          source_file_name?: string | null;
          source_folder_path?: string | null;
          source_syllabus_file_name?: string | null;
          source_syllabus_path?: string | null;
          extraction_confidence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CourseTemplateRecord, "id" | "created_at">>;
        Relationships: [];
      };
      course_template_assessments: {
        Row: CourseTemplateAssessmentRecord;
        Insert: {
          id?: string;
          course_template_id: string;
          name: string;
          weight_percentage?: number;
          max_score?: number;
          confidence?: number;
          source_text_snippet?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<CourseTemplateAssessmentRecord, "id" | "created_at">
        >;
        Relationships: [
          {
            foreignKeyName: "course_template_assessments_course_template_id_fkey";
            columns: ["course_template_id"];
            isOneToOne: false;
            referencedRelation: "course_templates";
            referencedColumns: ["id"];
          }
        ];
      };
      course_template_materials: {
        Row: CourseTemplateMaterialRecord;
        Insert: {
          id?: string;
          course_template_id: string;
          file_name: string;
          file_path: string;
          file_type?: string | null;
          material_type?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Omit<CourseTemplateMaterialRecord, "id" | "created_at">
        >;
        Relationships: [
          {
            foreignKeyName: "course_template_materials_course_template_id_fkey";
            columns: ["course_template_id"];
            isOneToOne: false;
            referencedRelation: "course_templates";
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

export type CourseTemplateWithDetails = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
  materials: CourseTemplateMaterialRecord[];
};
