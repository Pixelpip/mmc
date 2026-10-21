/**
 * Linux MMC/SD Card Detection Call Flow - Complete Kernel Reference Data
 * Mapped to sd_detect.png (2665 x 1203)
 */

const SD_FLOW_DATA = [
  {
    id: "box-1",
    step: 1,
    phase: "isr",
    phaseName: "ISR & Debounce",
    label: "irq_isr_status_changed",
    symbol: "sdhci_irq",
    altSymbol: "sdhci_card_event",
    file: "drivers/mmc/host/sdhci.c",
    line: 3100,
    x: 969.0,
    y: 26.0,
    width: 245.0,
    height: 51.0,
    protocol: "Hardware IRQ",
    summary: "Host controller card detect interrupt service routine (ISR)",
    details: "Triggered by physical card insertion or removal when the Card Detect (CD) pin changes state. The host controller hardware asserts an interrupt, and the SDHCI driver reads the interrupt status register (SDHCI_INT_STATUS) for SDHCI_INT_CARD_INSERT. It acknowledges the interrupt and schedules software handling.",
    code: `static irqreturn_t sdhci_irq(int irq, void *dev_id)
{
    struct sdhci_host *host = dev_id;
    u32 intmask = sdhci_readl(host, SDHCI_INT_STATUS);

    if (intmask & (SDHCI_INT_CARD_INSERT | SDHCI_INT_CARD_REMOVE)) {
        sdhci_writel(host, intmask & (SDHCI_INT_CARD_INSERT | SDHCI_INT_CARD_REMOVE),
                     SDHCI_INT_STATUS);
        host->ops->card_event(host);
        mmc_detect_changed(host->mmc, msecs_to_jiffies(200));
    }
    return IRQ_HANDLED;
}`
  },
  {
    id: "box-2",
    step: 2,
    phase: "isr",
    phaseName: "ISR & Debounce",
    label: "mmc_detect_changed()",
    symbol: "mmc_detect_changed",
    file: "drivers/mmc/core/core.c",
    line: 2150,
    x: 979.0,
    y: 125.0,
    width: 225.0,
    height: 51.0,
    protocol: "Core State Change",
    summary: "Process change of state on MMC socket and schedule debounce worker",
    details: "Invoked by host controller drivers when a card insertion or removal is detected. It takes the MMC host lock and delegates to the internal detect change handler with a debounce delay (typically 200ms) to ensure physical contact stability before querying pins.",
    code: `void mmc_detect_changed(struct mmc_host *host, unsigned long delay)
{
    unsigned long flags;

    spin_lock_irqsave(&host->lock, flags);
    _mmc_detect_change(host, delay, true);
    spin_unlock_irqrestore(&host->lock, flags);
}`
  },
  {
    id: "box-3",
    step: 3,
    phase: "isr",
    phaseName: "ISR & Debounce",
    label: "mmc_schedule_delayed_work(&host->detect, delay)",
    symbol: "mmc_schedule_delayed_work",
    file: "drivers/mmc/core/core.c",
    line: 120,
    x: 844.0,
    y: 223.0,
    width: 495.0,
    height: 51.0,
    protocol: "Workqueue Subsystem",
    summary: "Queue debounce delay work into kernel workqueue system",
    details: "Schedules host->detect delayed_work on the system workqueue (or system_freezable_wq). Because card detection requires bus clock toggling, sleepable waits, and multi-millisecond voltage settles, it cannot run in interrupt context. The workqueue ensures execution in process context.",
    code: `static inline bool mmc_schedule_delayed_work(struct delayed_work *work,
                                               unsigned long delay)
{
    return queue_delayed_work(system_freezable_wq, work, delay);
}`
  },
  {
    id: "box-4",
    step: 4,
    phase: "rescan",
    phaseName: "Rescan & Frequency",
    label: "mmc_rescan(struct work_struct *work)",
    symbol: "mmc_rescan",
    file: "drivers/mmc/core/core.c",
    line: 2200,
    x: 899.0,
    y: 322.0,
    width: 385.0,
    height: 51.0,
    protocol: "Slot Rescan Worker",
    summary: "Workqueue handler for card detect / slot rescanning & initialization",
    details: "The core worker function that executes after the debounce delay expires. Checks if a card is currently present in the slot via host->ops->get_cd(). If present and uninitialized, it initiates the frequency probing sequence by trying standard identification frequencies (400kHz, 300kHz, 200kHz, 100kHz).",
    code: `void mmc_rescan(struct work_struct *work)
{
    struct mmc_host *host =
        container_of(work, struct mmc_host, detect.work);
    int i;

    if (host->rescan_disable)
        return;

    /* Loop through frequency ladder */
    for (i = 0; i < ARRAY_SIZE(freqs); i++) {
        if (!mmc_rescan_try_freq(host, max(freqs[i], host->f_min)))
            break;
    }
}`
  },
  {
    id: "box-5",
    step: 5,
    phase: "rescan",
    phaseName: "Rescan & Frequency",
    label: "mmc_rescan_try_freq(struct mmc_host *host, unsigned freq)",
    symbol: "mmc_rescan_try_freq",
    file: "drivers/mmc/core/core.c",
    line: 2050,
    x: 794.0,
    y: 421.0,
    width: 595.0,
    height: 51.0,
    protocol: "Clock Ladder",
    summary: "Try to initialize host and bus at given clock frequency ladder",
    details: "Attempts card discovery at the specified frequency (starts at 400kHz per SD Specification). Powers up the bus, sends CMD0 (go idle), sends CMD8 (interface condition), and tests protocols in order: SDIO (CMD5) -> SD (ACMD41) -> MMC (CMD1).",
    code: `static int mmc_rescan_try_freq(struct mmc_host *host, unsigned freq)
{
    host->f_init = freq;
    pr_debug("%s: %s: trying to init card at %u Hz\\n",
             mmc_hostname(host), __func__, host->f_init);

    mmc_power_up(host, host->ocr_avail);
    mmc_hw_reset_for_init(host);
    mmc_go_idle(host);

    mmc_send_if_cond(host, host->ocr_avail);

    /* Test protocol support */
    if (!mmc_attach_sdio(host))
        return 0;
    if (!mmc_attach_sd(host))
        return 0;
    if (!mmc_attach_mmc(host))
        return 0;

    mmc_power_off(host);
    return -EIO;
}`
  },
  {
    id: "box-6",
    step: 6,
    phase: "power",
    phaseName: "Power & Reset",
    label: "mmc_power_up(struct mmc_host *host)",
    symbol: "mmc_power_up",
    file: "drivers/mmc/core/core.c",
    line: 1680,
    x: 25.0,
    y: 519.0,
    width: 375.0,
    height: 51.0,
    protocol: "Power Management",
    summary: "Ramp up host controller power supply and apply power to bus",
    details: "Ramps up regulator voltages to supply power to the card socket, sets the bus power mode to MMC_POWER_UP, programs the initial clock to host->f_init (400kHz), and waits the specification-mandated power ramp delay before sending signals.",
    code: `void mmc_power_up(struct mmc_host *host, u32 ocr)
{
    if (host->ios.power_mode == MMC_POWER_ON)
        return;

    host->ios.vdd = fls(ocr) - 1;
    host->ios.power_mode = MMC_POWER_UP;
    host->ios.bus_width = MMC_BUS_WIDTH_1;
    host->ios.clock = host->f_init;

    mmc_set_ios(host);
    mmc_delay(host->ios.power_delay_ms);

    host->ios.power_mode = MMC_POWER_ON;
    mmc_set_ios(host);
}`
  },
  {
    id: "box-7",
    step: 7,
    phase: "power",
    phaseName: "Power & Reset",
    label: "mmc_hw_reset_for_init(struct mmc_host *host)",
    symbol: "mmc_hw_reset_for_init",
    file: "drivers/mmc/core/core.c",
    line: 1720,
    x: 421.0,
    y: 519.0,
    width: 466.0,
    height: 51.0,
    protocol: "Hardware Reset",
    summary: "Perform hardware reset before initiating card probe",
    details: "Checks whether the host controller and board layout implement a dedicated hardware reset line (RST_n pin). If supported via host->ops->hw_reset, triggers a hard low pulse to force the card into a clean initial state.",
    code: `static void mmc_hw_reset_for_init(struct mmc_host *host)
{
    if (!host->ops->hw_reset)
        return;

    host->ops->hw_reset(host);
}`
  },
  {
    id: "box-8",
    step: 8,
    phase: "power",
    phaseName: "Power & Reset",
    label: "mmc_go_idle(struct mmc_host *host) /*send cmd0*/",
    symbol: "mmc_go_idle",
    file: "drivers/mmc/core/mmc_ops.c",
    line: 150,
    x: 909.0,
    y: 519.0,
    width: 365.0,
    height: 51.0,
    protocol: "CMD0 (GO_IDLE_STATE)",
    summary: "Issue CMD0 (GO_IDLE_STATE) to bring cards to Idle state",
    details: "Sends broadcast command CMD0 with argument 0x00000000. All connected cards on the bus reset their internal state machine and enter the Idle State. In SPI mode, CS must be pulled low; in SD native bus mode, all cards transition from any state back to idle.",
    code: `int mmc_go_idle(struct mmc_host *host)
{
    int err;
    struct mmc_command cmd = {0};

    cmd.opcode = MMC_GO_IDLE_STATE; /* CMD0 */
    cmd.arg = 0;
    cmd.flags = MMC_RSP_SPI_R1 | MMC_RSP_NONE | MMC_CMD_BC;

    err = mmc_wait_for_cmd(host, &cmd, 0);
    mmc_delay(1);

    return err;
}`
  },
  {
    id: "box-9",
    step: 9,
    phase: "power",
    phaseName: "Power & Reset",
    label: "mmc_send_if_cond(struct mmc_host *host, u32 ocr) /*send cmd8, check if support sd2.0 cards*/",
    symbol: "mmc_send_if_cond",
    file: "drivers/mmc/core/sd_ops.c",
    line: 140,
    x: 1296.0,
    y: 519.0,
    width: 506.0,
    height: 51.0,
    protocol: "CMD8 (SEND_IF_COND)",
    summary: "Issue CMD8 (SEND_IF_COND) to verify voltage operating range & SD 2.0+ compatibility",
    details: "Sends CMD8 with argument containing supply voltage indicator (0x1 = 2.7-3.6V) and check pattern 0xAA. If the card echoes back response R7 with the exact same 0xAA pattern, the card supports SD Physical Layer Specification Version 2.00 or higher (SDHC/SDXC capacity support).",
    code: `int mmc_send_if_cond(struct mmc_host *host, u32 ocr)
{
    struct mmc_command cmd = {0};
    int err;
    static const u8 test_pattern = 0xAA;
    u8 result_pattern;

    cmd.opcode = SD_SEND_IF_COND; /* CMD8 */
    cmd.arg = ((ocr & 0xFF8000) != 0) << 8 | test_pattern;
    cmd.flags = MMC_RSP_SPI_R7 | MMC_RSP_R7 | MMC_CMD_BCR;

    err = mmc_wait_for_cmd(host, &cmd, MMC_CMD_RETRIES);
    if (err)
        return err;

    result_pattern = cmd.resp[0] & 0xFF;
    if (result_pattern != test_pattern)
        return -EIO;

    return 0;
}`
  },
  {
    id: "box-10",
    step: 10,
    phase: "protocol",
    phaseName: "Protocol & Bus Attach",
    label: "mmc_attach_sdio/sd/mmc(struct mmc_host *host) /*test which protocol support, now using sd as example*/",
    symbol: "mmc_attach_sd",
    altSymbol: "mmc_attach_sdio",
    file: "drivers/mmc/core/sd.c",
    line: 1200,
    x: 1823.0,
    y: 519.0,
    width: 585.0,
    height: 51.0,
    protocol: "Protocol Identification",
    summary: "Probe card protocol support (SDIO -> SD -> MMC); attach SD card bus",
    details: "The kernel systematically probes connected hardware protocol. First checks for SDIO cards via CMD5. If unacknowledged, invokes mmc_attach_sd() which sends ACMD41. If that succeeds, the bus is identified as standard SD memory card and SD bus ops are registered.",
    code: `int mmc_attach_sd(struct mmc_host *host)
{
    int err;
    u32 ocr, rocr;

    WARN_ON(!host->claimed);

    /* ACMD41 probe to get card OCR */
    err = mmc_send_app_op_cond(host, 0, &ocr);
    if (err)
        return err;

    mmc_sd_attach_bus_ops(host);
    if (mmc_host_is_spi(host)) {
        mmc_claim_host(host);
        err = mmc_spi_read_ocr(host, 0, &ocr);
        mmc_release_host(host);
    }

    rocr = mmc_select_voltage(host, ocr);
    err = mmc_sd_init_card(host, rocr, NULL);
    err = mmc_add_card(host->card);
    return 0;
}`
  },
  {
    id: "box-11",
    step: 11,
    phase: "protocol",
    phaseName: "Protocol & Bus Attach",
    label: "host->ops->hw_reset(host)",
    symbol: "mmc_host_ops",
    file: "include/linux/mmc/host.h",
    line: 110,
    x: 25.0,
    y: 618.0,
    width: 275.0,
    height: 51.0,
    protocol: "Host Controller Ops",
    summary: "Hardware-specific reset callback defined in struct mmc_host_ops",
    details: "Function pointer inside struct mmc_host_ops. Host controller drivers (such as sdhci, dw_mmc, omap_hsmmc) implement this hook to perform platform-specific hardware reset sequences, GPIO pin toggles, or vendor reset registers.",
    code: `struct mmc_host_ops {
    void (*post_req)(struct mmc_host *host, struct mmc_request *req, int err);
    void (*pre_req)(struct mmc_host *host, struct mmc_request *req);
    void (*request)(struct mmc_host *host, struct mmc_request *req);
    void (*set_ios)(struct mmc_host *host, struct mmc_ios *ios);
    int  (*get_ro)(struct mmc_host *host);
    int  (*get_cd)(struct mmc_host *host);
    void (*hw_reset)(struct mmc_host *host);
    ...
};`
  },
  {
    id: "box-12",
    step: 12,
    phase: "protocol",
    phaseName: "Protocol & Bus Attach",
    label: "mmc_send_app_op_cond() /*send cmd41*/",
    symbol: "mmc_send_app_op_cond",
    file: "drivers/mmc/core/sd_ops.c",
    line: 170,
    x: 321.0,
    y: 618.0,
    width: 245.0,
    height: 51.0,
    protocol: "ACMD41 (SD_APP_OP_COND)",
    summary: "Send ACMD41 (SD_APP_OP_COND) to inquire operating condition & card capacity",
    details: "Application-specific command: sends CMD55 (APP_CMD) followed by ACMD41 with HCS (High Capacity Support) bit set. The card replies with OCR register containing supported voltage windows and sets the power-up status busy bit (bit 31) when internal power-on init completes.",
    code: `int mmc_send_app_op_cond(struct mmc_host *host, u32 ocr, u32 *rocr)
{
    struct mmc_command cmd = {0};
    int i, err = 0;

    cmd.opcode = SD_APP_OP_COND; /* ACMD41 */
    cmd.arg = mmc_host_is_spi(host) ? 0 : ocr;
    cmd.flags = MMC_RSP_SPI_R1 | MMC_RSP_R3 | MMC_CMD_BCR;

    for (i = 100; i; i--) {
        err = mmc_app_cmd(host, NULL); /* Send CMD55 */
        if (err)
            break;

        err = mmc_wait_for_cmd(host, &cmd, MMC_CMD_RETRIES);
        if (cmd.resp[0] & MMC_CARD_BUSY)
            break;
        mmc_delay(10);
    }
    if (rocr)
        *rocr = cmd.resp[0];
    return err;
}`
  },
  {
    id: "box-13",
    step: 13,
    phase: "protocol",
    phaseName: "Protocol & Bus Attach",
    label: "mmc_sd_attach_bus_ops(struct mmc_host *host)",
    symbol: "mmc_sd_attach_bus_ops",
    file: "drivers/mmc/core/sd.c",
    line: 1150,
    x: 588.0,
    y: 618.0,
    width: 466.0,
    height: 51.0,
    protocol: "Bus Operations",
    summary: "Attach SD specific bus operations table to the MMC host",
    details: "Links the struct mmc_bus_ops table (specifically mmc_sd_ops) to host->bus_ops. This binds handlers for remove, detect, suspend, resume, runtime_suspend, and power_restore specifically tailored for SD protocol cards.",
    code: `static const struct mmc_bus_ops mmc_sd_ops = {
    .remove = mmc_sd_remove,
    .detect = mmc_sd_detect,
    .suspend = mmc_sd_suspend,
    .resume = mmc_sd_resume,
    .alive = mmc_sd_alive,
    .shutdown = mmc_sd_shutdown,
};

static void mmc_sd_attach_bus_ops(struct mmc_host *host)
{
    mmc_attach_bus(host, &mmc_sd_ops);
}`
  },
  {
    id: "box-14",
    step: 14,
    phase: "protocol",
    phaseName: "Protocol & Bus Attach",
    label: "mmc_select_voltage(struct mmc_host *host, u32 ocr)",
    symbol: "mmc_select_voltage",
    file: "drivers/mmc/core/core.c",
    line: 1450,
    x: 1074.0,
    y: 618.0,
    width: 526.0,
    height: 51.0,
    protocol: "OCR Negotiation",
    summary: "Select highest mutually supported voltage between host and card OCR",
    details: "Masks the card's reported OCR voltage bitmask against the host controller's supported voltages (host->ocr_avail). Selects the highest common voltage bit, programs the host regulator via mmc_set_ios(), and returns the final negotiated OCR value.",
    code: `u32 mmc_select_voltage(struct mmc_host *host, u32 ocr)
{
    int bit;

    ocr &= host->ocr_avail;
    if (!ocr) {
        dev_warn(mmc_dev(host), "host doesn't support card's voltages\\n");
        return 0;
    }

    bit = fls(ocr) - 1;
    host->ios.vdd = bit;
    mmc_set_ios(host);
    return 1 << bit;
}`
  },
  {
    id: "box-15",
    step: 15,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "mmc_sd_init_card() /*alloc mmc_card*/",
    symbol: "mmc_sd_init_card",
    file: "drivers/mmc/core/sd.c",
    line: 850,
    x: 1621.0,
    y: 618.0,
    width: 205.0,
    height: 51.0,
    protocol: "Card Identification",
    summary: "Allocate mmc_card structure, read CID/CSD/SCR, and initialize SD card",
    details: "Crucial SD initialization pipeline: 1) Allocates struct mmc_card, 2) Sends CMD2 (ALL_SEND_CID) to read unique card ID, 3) Sends CMD3 (SEND_RELATIVE_ADDR) to assign RCA (Relative Card Address), 4) Sends CMD9 to read CSD (Card Specific Data), 5) Sends CMD7 to select card, 6) Reads SCR and switches to 4-bit bus width & High Speed mode.",
    code: `static int mmc_sd_init_card(struct mmc_host *host, u32 ocr,
                            struct mmc_card *oldcard)
{
    struct mmc_card *card;
    int err;

    /* Read CID via CMD2 */
    err = mmc_send_cid(host, cid);
    card = mmc_alloc_card(host, &sd_type);

    /* Assign Relative Card Address (RCA) via CMD3 */
    err = mmc_send_relative_addr(host, &card->rca);
    /* Read CSD via CMD9 */
    err = mmc_send_csd(card, card->raw_csd);
    /* Select card via CMD7 */
    err = mmc_select_card(card);
    /* Read SCR and switch to 4-bit bus width */
    err = mmc_app_send_scr(card, card->raw_scr);
    err = mmc_sd_switch_hs(card);
    host->card = card;
    return 0;
}`
  },
  {
    id: "box-16",
    step: 16,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "mmc_add_card(struct mmc_card *card)",
    symbol: "mmc_add_card",
    file: "drivers/mmc/core/bus.c",
    line: 320,
    x: 1848.0,
    y: 618.0,
    width: 375.0,
    height: 51.0,
    protocol: "Driver Core / Bus",
    summary: "Register initialized card device into the Linux driver model device tree",
    details: "Populates the card's struct device fields (device name mmc0:0001, dev.bus = &mmc_bus_type, dev.parent = &host->class_dev), initializes sysfs attributes (cid, csd, date, name, oemid, serial), and calls device_add(&card->dev).",
    code: `int mmc_add_card(struct mmc_card *card)
{
    int ret;
    dev_set_name(&card->dev, "%s:%04x", mmc_hostname(card->host), card->rca);

    ret = device_add(&card->dev);
    if (ret)
        return ret;

    mmc_card_set_present(card);
    return 0;
}`
  },
  {
    id: "box-17",
    step: 17,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "mmc_claim_host(struct mmc_host *host)",
    symbol: "mmc_claim_host",
    file: "include/linux/mmc/host.h",
    line: 250,
    x: 2245.0,
    y: 618.0,
    width: 395.0,
    height: 51.0,
    protocol: "Host Mutex Lock",
    summary: "Acquire exclusive claim lock on the host controller for bus transactions",
    details: "Acquires exclusive bus lock on the host controller. Because SD bus commands and multi-block DMA transfers require atomic access to physical command and data lines, callers claim the host before issuing commands and release it when complete.",
    code: `static inline void mmc_claim_host(struct mmc_host *host)
{
    __mmc_claim_host(host, NULL);
}`
  },
  {
    id: "box-18",
    step: 18,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "mmc_set_ios()",
    symbol: "mmc_set_ios",
    file: "drivers/mmc/core/core.c",
    line: 950,
    x: 1259.0,
    y: 717.0,
    width: 155.0,
    height: 51.0,
    protocol: "Host IOS Configuration",
    summary: "Pass updated clock, power, voltage, and bus configuration to host driver",
    details: "Synchronizes struct mmc_ios (I/O settings) with physical hardware registers: updates clock frequency (up to 25MHz/50MHz/SDR104), bus width (1-bit vs 4-bit vs 8-bit), signal voltage (3.3V vs 1.8V UHS-I), and power state.",
    code: `static void mmc_set_ios(struct mmc_host *host)
{
    struct mmc_ios *ios = &host->ios;

    pr_debug("%s: clock %uHz busmode %u powermode %u cs %u Vdd %u width %u timing %u\\n",
             mmc_hostname(host), ios->clock, ios->bus_mode,
             ios->power_mode, ios->chip_select, ios->vdd,
             ios->bus_width, ios->timing);

    host->ops->set_ios(host, ios);
}`
  },
  {
    id: "box-19",
    step: 19,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "device_add(&card->dev)",
    symbol: "device_add",
    file: "drivers/base/core.c",
    line: 2800,
    x: 1913.0,
    y: 717.0,
    width: 245.0,
    height: 51.0,
    protocol: "Linux Device Model",
    summary: "Register device with sysfs, notify userspace (uevent), and add to bus",
    details: "Standard Linux kernel device model registration. Creates sysfs directories under /sys/bus/mmc/devices/, issues a KOBJ_ADD uevent for udev rules to process, links parent/child power management, and invokes bus_probe_device(dev) to bind a matching driver.",
    code: `int device_add(struct device *dev)
{
    struct device *parent = NULL;
    int error = -EINVAL;

    dev = get_device(dev);
    parent = get_device(dev->parent);

    error = device_create_file(dev, &dev_attr_uevent);
    kobject_uevent(&dev->kobj, KOBJ_ADD);
    bus_probe_device(dev);

    return 0;
}`
  },
  {
    id: "box-20",
    step: 20,
    phase: "card_init",
    phaseName: "Card Init & Device Model",
    label: "bus_probe_device(dev)",
    symbol: "bus_probe_device",
    file: "drivers/base/core.c",
    line: 580,
    x: 1918.0,
    y: 815.0,
    width: 235.0,
    height: 51.0,
    protocol: "Bus Driver Match",
    summary: "Probe driver matches on bus to bind appropriate driver to new card device",
    details: "Iterates through the drivers registered on dev->bus (mmc_bus_type). Compares card attributes with driver id_tables. Matches the MMC Block driver (mmc_blk_driver) and invokes driver->probe(dev) -> mmc_blk_probe().",
    code: `void bus_probe_device(struct device *dev)
{
    struct bus_type *bus = dev->bus;
    struct subsys_interface *sif;

    if (!bus)
        return;

    if (bus->p->drivers_autoprobe)
        device_initial_probe(dev);

    mutex_lock(&bus->p->mutex);
    list_for_each_entry(sif, &bus->p->interfaces, node)
        if (sif->add_dev)
            sif->add_dev(dev, sif);
    mutex_unlock(&bus->p->mutex);
}`
  },
  {
    id: "box-21",
    step: 21,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "mmc_blk_probe(struct mmc_card *card) /*in block.c*/",
    symbol: "mmc_blk_probe",
    file: "drivers/mmc/card/block.c",
    line: 2500,
    x: 1843.0,
    y: 914.0,
    width: 385.0,
    height: 51.0,
    protocol: "MMC Block Driver Probe",
    summary: "MMC block device driver probe callback handling block layer integration",
    details: "Called when the MMC bus matches card type MMC_TYPE_SD_COMBO or MMC_TYPE_SD. Allocates block driver private data, configures read-ahead and bounce buffers, discovers hardware partitions (RPMB, boot partitions), and registers the main gendisk disk device.",
    code: `static int mmc_blk_probe(struct mmc_card *card)
{
    struct mmc_blk_data *md;

    md = mmc_blk_alloc(card);
    if (IS_ERR(md))
        return PTR_ERR(md);

    string_get_size((u64)get_capacity(md->disk), 512, STRING_UNITS_2,
                    cap_str, sizeof(cap_str));
    pr_info("%s: %s %s %s\\n",
            md->disk->disk_name, mmc_card_id(card),
            mmc_card_name(card), cap_str);

    mmc_blk_alloc_parts(card, md);
    ret = mmc_add_disk(md);
    return 0;
}`
  },
  {
    id: "box-22",
    step: 22,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "mmc_blk_alloc(struct mmc_card *card)",
    symbol: "mmc_blk_alloc",
    file: "drivers/mmc/card/block.c",
    line: 2350,
    x: 1511.0,
    y: 1013.0,
    width: 385.0,
    height: 51.0,
    protocol: "Queue & Data Allocation",
    summary: "Allocate mmc_blk_data structure and request queue for block transfer",
    details: "Allocates struct mmc_blk_data, initializes the blk-mq request queue (or classic request queue), sets queue parameters (max sector size, max segment size, discard/trim capabilities), and sets up the gendisk structure.",
    code: `static struct mmc_blk_data *mmc_blk_alloc(struct mmc_card *card)
{
    struct mmc_blk_data *md;
    struct gendisk *disk;

    md = kzalloc(sizeof(struct mmc_blk_data), GFP_KERNEL);
    if (!md)
        return ERR_PTR(-ENOMEM);

    disk = blk_mq_alloc_disk(&md->tag_set, md);
    md->disk = disk;
    md->queue.card = card;

    return md;
}`
  },
  {
    id: "box-23",
    step: 23,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "mmc_blk_alloc_parts()",
    symbol: "mmc_blk_alloc_parts",
    file: "drivers/mmc/card/block.c",
    line: 2420,
    x: 1918.0,
    y: 1013.0,
    width: 235.0,
    height: 51.0,
    protocol: "Hardware Partitions",
    summary: "Allocate hardware partitions (boot partitions, RPMB, GP partitions)",
    details: "For eMMC and modern SD specifications with physical partitions: examines EXT_CSD to check for Boot Partition 1 & 2, RPMB (Replay Protected Memory Block), and General Purpose Partitions. Creates child block devices (e.g. mmcblk0boot0, mmcblk0rpmb).",
    code: `static int mmc_blk_alloc_parts(struct mmc_card *card, struct mmc_blk_data *md)
{
    int idx, ret = 0;

    if (!mmc_card_mmc(card))
        return 0;

    for (idx = 0; idx < MMC_NUM_PHY_PARTITION; idx++) {
        if (!card->part[idx].size)
            continue;
        ret = mmc_blk_alloc_part(card, md, card->part[idx].part_cfg,
                                 card->part[idx].size >> 9,
                                 card->part[idx].force_ro,
                                 card->part[idx].name,
                                 card->part[idx].area_type);
        if (ret)
            return ret;
    }
    return ret;
}`
  },
  {
    id: "box-24",
    step: 24,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "mmc_add_disk(struct mmc_blk_data *md)",
    symbol: "mmc_add_disk",
    file: "drivers/mmc/card/block.c",
    line: 2280,
    x: 2174.0,
    y: 1013.0,
    width: 395.0,
    height: 51.0,
    protocol: "Disk Publishing",
    summary: "Attach gendisk structure to block device and register with kernel",
    details: "Configures disk name format (e.g., mmcblk0 or mmcblk1), assigns major/minor numbers, sets capacity in 512-byte sectors, and calls device_add_disk() / add_disk(). This makes the storage device visible in /proc/partitions and /dev/.",
    code: `static int mmc_add_disk(struct mmc_blk_data *md)
{
    int ret;
    struct mmc_card *card = md->queue.card;

    ret = device_add_disk(&card->dev, md->disk, mmc_disk_attr_groups);
    if (ret)
        return ret;

    return 0;
}`
  },
  {
    id: "box-25",
    step: 25,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "mmc_blk_alloc_req() /* minor number allocation */",
    symbol: "mmc_blk_alloc_req",
    file: "drivers/mmc/card/block.c",
    line: 2180,
    x: 1226.0,
    y: 1111.0,
    width: 955.0,
    height: 65.0,
    protocol: "Minor Numbers",
    summary: "Allocate queue request and device minor numbers (step of 8 minors per card)",
    details: "Allocates unique device minor numbers using kernel ID allocation (IDA). In Linux MMC subsystem, each disk reserves a chunk (typically 8 or 16 minors) to allow partition nodes: /dev/mmcblk0 (minor 0), /dev/mmcblk0p1 (minor 1), up to /dev/mmcblk0p7.",
    code: `static struct mmc_blk_data *mmc_blk_alloc_req(struct mmc_card *card,
                                              struct device *parent,
                                              sector_t size,
                                              bool default_ro,
                                              const char *subname,
                                              int area_type)
{
    int devidx;

    devidx = ida_alloc_max(&mmc_blk_ida, max_devices - 1, GFP_KERNEL);
    if (devidx < 0)
        return ERR_PTR(devidx);

    snprintf(disk->disk_name, sizeof(disk->disk_name),
             "mmcblk%d%s", devidx, subname ? subname : "");
    ...
}`
  },
  {
    id: "box-26",
    step: 26,
    phase: "block",
    phaseName: "Block Layer & Disk",
    label: "add_disk(struct gendisk *disk)",
    symbol: "add_disk",
    file: "block/genhd.c",
    line: 380,
    x: 2209.0,
    y: 1118.0,
    width: 325.0,
    height: 51.0,
    protocol: "Kernel Block Core",
    summary: "Publish block device disk to userspace, scan partition table, enable I/O",
    details: "The culminating step of block device creation: 1) Registers /dev/mmcblkX with devtmpfs, 2) Triggers kernel partition table scanner (reads MBR / GPT), 3) Creates child partition devices /dev/mmcblkXp1...pN, 4) Emits uevents so userspace managers (udev / systemd / mount) can mount filesystems.",
    code: `int device_add_disk(struct device *parent, struct gendisk *disk,
                    const struct attribute_group **groups)
{
    int ret;

    /* Register bdi, sysfs, and scan partitions */
    ret = bdi_register(disk->bdi, "%u:%u", disk->major, disk->first_minor);
    register_disk(parent, disk, groups);
    blk_register_queue(disk);

    /* Scans MBR / GPT partitions and emits uevents */
    disk_scan_partitions(disk, FMODE_READ);
    return 0;
}`
  }
];

// Helper to construct URLs for various kernel source browsers
const KERNEL_EXPLORERS = {
  bootlin_v66: {
    name: "Bootlin Elixir (v6.6 LTS)",
    buildSymbolUrl: (item) => `https://elixir.bootlin.com/linux/v6.6/ident/${item.symbol}`,
    buildFileUrl: (item) => `https://elixir.bootlin.com/linux/v6.6/source/${item.file}#L${item.line || 1}`
  },
  bootlin_v612: {
    name: "Bootlin Elixir (v6.12)",
    buildSymbolUrl: (item) => `https://elixir.bootlin.com/linux/v6.12/ident/${item.symbol}`,
    buildFileUrl: (item) => `https://elixir.bootlin.com/linux/v6.12/source/${item.file}#L${item.line || 1}`
  },
  bootlin_v515: {
    name: "Bootlin Elixir (v5.15 LTS)",
    buildSymbolUrl: (item) => `https://elixir.bootlin.com/linux/v5.15/ident/${item.symbol}`,
    buildFileUrl: (item) => `https://elixir.bootlin.com/linux/v5.15/source/${item.file}#L${item.line || 1}`
  },
  bootlin_v37: {
    name: "Bootlin Elixir (v3.7 Doc Era)",
    buildSymbolUrl: (item) => `https://elixir.bootlin.com/linux/v3.7/ident/${item.symbol}`,
    buildFileUrl: (item) => `https://elixir.bootlin.com/linux/v3.7/source/${item.file}#L${item.line || 1}`
  },
  github_master: {
    name: "GitHub Linux (torvalds/linux)",
    buildSymbolUrl: (item) => `https://github.com/torvalds/linux/search?q=${item.symbol}`,
    buildFileUrl: (item) => `https://github.com/torvalds/linux/blob/master/${item.file}`
  },
  kernel_org: {
    name: "Kernel.org cgit",
    buildSymbolUrl: (item) => `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/${item.file}`,
    buildFileUrl: (item) => `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/${item.file}`
  }
};
