ALTER TABLE coop_service_resources
    ADD COLUMN requires_virtual_machine TINYINT(1) NOT NULL DEFAULT 0 AFTER activo,
    ADD COLUMN virtual_machine_notes TEXT DEFAULT NULL AFTER requires_virtual_machine;

ALTER TABLE coop_service_resources
    ADD KEY idx_coop_service_resources_vm (requires_virtual_machine);
