--
-- PostgreSQL database dump
--

\restrict SHArmmFW9gRJWYDZF3dCF9hZUzZ6B9O6uNJGsthJIoOXgxelN6Os3GaWc3dFm5Q

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: job_status; Type: TYPE; Schema: public; Owner: erp_user
--

CREATE TYPE public.job_status AS ENUM (
    'pending',
    'measuring',
    'in_production',
    'ready_for_installation',
    'installed',
    'completed',
    'cancelled'
);


ALTER TYPE public.job_status OWNER TO erp_user;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: erp_user
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'bank_transfer',
    'instapay',
    'cheque',
    'other'
);


ALTER TYPE public.payment_method OWNER TO erp_user;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: erp_user
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE public.payment_status OWNER TO erp_user;

--
-- Name: payment_type; Type: TYPE; Schema: public; Owner: erp_user
--

CREATE TYPE public.payment_type AS ENUM (
    'deposit',
    'production',
    'final'
);


ALTER TYPE public.payment_type OWNER TO erp_user;

--
-- Name: quotation_status; Type: TYPE; Schema: public; Owner: erp_user
--

CREATE TYPE public.quotation_status AS ENUM (
    'draft',
    'sent',
    'approved',
    'rejected',
    'cancelled',
    'waiting_for_measurement',
    'measured',
    'under_negotiation',
    'expired'
);


ALTER TYPE public.quotation_status OWNER TO erp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_value text,
    new_value text,
    user_name character varying(200),
    user_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    metadata json
);


ALTER TABLE public.activity_logs OWNER TO erp_user;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO erp_user;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(255) NOT NULL,
    phone_number character varying(50) NOT NULL,
    alternative_phone character varying(50),
    address text,
    city character varying(100),
    location_url character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO erp_user;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    measurement_date date,
    production_start date,
    production_end date,
    installation_date date,
    delivery_date date,
    completion_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.jobs OWNER TO erp_user;

--
-- Name: measurement_items; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.measurement_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    measurement_id uuid NOT NULL,
    quotation_item_id uuid NOT NULL,
    room_name character varying(100),
    piece_number character varying(100),
    width numeric(10,2),
    height numeric(10,2),
    quantity smallint DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_measurement_items_height_nonneg CHECK (((height IS NULL) OR (height >= (0)::numeric))),
    CONSTRAINT ck_measurement_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT ck_measurement_items_width_nonneg CHECK (((width IS NULL) OR (width >= (0)::numeric)))
);


ALTER TABLE public.measurement_items OWNER TO erp_user;

--
-- Name: measurements; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    measurement_number smallint DEFAULT 1 NOT NULL,
    visit_date date,
    measured_by character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_measurements_measurement_number_positive CHECK ((measurement_number > 0))
);


ALTER TABLE public.measurements OWNER TO erp_user;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    payment_order smallint NOT NULL,
    payment_type public.payment_type NOT NULL,
    payment_method public.payment_method NOT NULL,
    percentage numeric(5,2) DEFAULT 0.00 NOT NULL,
    amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    due_date date,
    paid_date date,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_payments_amount_nonneg CHECK ((amount >= (0)::numeric)),
    CONSTRAINT ck_payments_payment_order_positive CHECK ((payment_order > 0)),
    CONSTRAINT ck_payments_percentage_range CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))
);


ALTER TABLE public.payments OWNER TO erp_user;

--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_categories OWNER TO erp_user;

--
-- Name: products; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO erp_user;

--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity smallint DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    description character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_quotation_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT ck_quotation_items_total_price_nonneg CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT ck_quotation_items_unit_price_nonneg CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.quotation_items OWNER TO erp_user;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_number character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    quotation_date date NOT NULL,
    status public.quotation_status DEFAULT 'draft'::public.quotation_status NOT NULL,
    total_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    discount numeric(12,2) DEFAULT 0.00 NOT NULL,
    final_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_quotations_discount_nonneg CHECK ((discount >= (0)::numeric)),
    CONSTRAINT ck_quotations_final_price_nonneg CHECK ((final_price >= (0)::numeric)),
    CONSTRAINT ck_quotations_total_price_nonneg CHECK ((total_price >= (0)::numeric))
);


ALTER TABLE public.quotations OWNER TO erp_user;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_date date NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    file_path character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reports OWNER TO erp_user;

--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.activity_logs (id, job_id, action, description, created_at, updated_at, previous_value, new_value, user_name, user_id, entity_type, entity_id, metadata) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.alembic_version (version_num) FROM stdin;
a29e95c0bee6
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.customers (id, full_name, phone_number, alternative_phone, address, city, location_url, notes, created_at, updated_at) FROM stdin;
48e66fef-f545-4ca6-b933-6b007a85589f	Production Test Customer	+201098765432	\N	Test Street 123	Cairo	\N	\N	2026-07-27 11:20:42.969359+00	2026-07-27 11:20:42.969364+00
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.jobs (id, quotation_id, status, measurement_date, production_start, production_end, installation_date, delivery_date, completion_date, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: measurement_items; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.measurement_items (id, measurement_id, quotation_item_id, room_name, piece_number, width, height, quantity, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: measurements; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.measurements (id, job_id, measurement_number, visit_date, measured_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.payments (id, job_id, payment_order, payment_type, payment_method, percentage, amount, due_date, paid_date, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_categories; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.product_categories (id, name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.products (id, category_id, name, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotation_items; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.quotation_items (id, quotation_id, product_id, quantity, unit_price, total_price, description, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.quotations (id, quotation_number, customer_id, quotation_date, status, total_price, discount, final_price, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.reports (id, report_date, generated_at, file_path, created_at, updated_at) FROM stdin;
\.


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_quotation_id_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_quotation_id_key UNIQUE (quotation_id);


--
-- Name: measurement_items measurement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurement_items
    ADD CONSTRAINT measurement_items_pkey PRIMARY KEY (id);


--
-- Name: measurements measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurements
    ADD CONSTRAINT measurements_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_name_key UNIQUE (name);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: measurements uq_measurements_job_id_measurement_number; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurements
    ADD CONSTRAINT uq_measurements_job_id_measurement_number UNIQUE (job_id, measurement_number);


--
-- Name: payments uq_payments_job_id_payment_order; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT uq_payments_job_id_payment_order UNIQUE (job_id, payment_order);


--
-- Name: products uq_products_category_id_name; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT uq_products_category_id_name UNIQUE (category_id, name);


--
-- Name: ix_activity_logs_action; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: ix_activity_logs_created_at; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: ix_activity_logs_entity_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_entity_id ON public.activity_logs USING btree (entity_id);


--
-- Name: ix_activity_logs_entity_type; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_entity_type ON public.activity_logs USING btree (entity_type);


--
-- Name: ix_activity_logs_job_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_job_id ON public.activity_logs USING btree (job_id);


--
-- Name: ix_activity_logs_user_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: ix_customers_full_name; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_customers_full_name ON public.customers USING btree (full_name);


--
-- Name: ix_customers_phone_number; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_customers_phone_number ON public.customers USING btree (phone_number);


--
-- Name: ix_jobs_quotation_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE UNIQUE INDEX ix_jobs_quotation_id ON public.jobs USING btree (quotation_id);


--
-- Name: ix_jobs_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_jobs_status ON public.jobs USING btree (status);


--
-- Name: ix_measurement_items_measurement_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_measurement_items_measurement_id ON public.measurement_items USING btree (measurement_id);


--
-- Name: ix_measurement_items_quotation_item_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_measurement_items_quotation_item_id ON public.measurement_items USING btree (quotation_item_id);


--
-- Name: ix_measurements_job_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_measurements_job_id ON public.measurements USING btree (job_id);


--
-- Name: ix_payments_due_date; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_payments_due_date ON public.payments USING btree (due_date);


--
-- Name: ix_payments_job_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_payments_job_id ON public.payments USING btree (job_id);


--
-- Name: ix_payments_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_payments_status ON public.payments USING btree (status);


--
-- Name: ix_products_category_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_products_category_id ON public.products USING btree (category_id);


--
-- Name: ix_quotation_items_product_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_quotation_items_product_id ON public.quotation_items USING btree (product_id);


--
-- Name: ix_quotation_items_quotation_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_quotation_items_quotation_id ON public.quotation_items USING btree (quotation_id);


--
-- Name: ix_quotations_customer_id; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_quotations_customer_id ON public.quotations USING btree (customer_id);


--
-- Name: ix_quotations_quotation_date; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_quotations_quotation_date ON public.quotations USING btree (quotation_date);


--
-- Name: ix_quotations_quotation_number; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE UNIQUE INDEX ix_quotations_quotation_number ON public.quotations USING btree (quotation_number);


--
-- Name: ix_quotations_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_quotations_status ON public.quotations USING btree (status);


--
-- Name: ix_reports_report_date; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX ix_reports_report_date ON public.reports USING btree (report_date);


--
-- Name: activity_logs activity_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: measurement_items measurement_items_measurement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurement_items
    ADD CONSTRAINT measurement_items_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES public.measurements(id) ON DELETE CASCADE;


--
-- Name: measurement_items measurement_items_quotation_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurement_items
    ADD CONSTRAINT measurement_items_quotation_item_id_fkey FOREIGN KEY (quotation_item_id) REFERENCES public.quotation_items(id) ON DELETE RESTRICT;


--
-- Name: measurements measurements_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.measurements
    ADD CONSTRAINT measurements_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: payments payments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE RESTRICT;


--
-- Name: quotation_items quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict SHArmmFW9gRJWYDZF3dCF9hZUzZ6B9O6uNJGsthJIoOXgxelN6Os3GaWc3dFm5Q

