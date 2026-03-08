import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const summary: Record<string, number> = {};

    // Check if already seeded
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
    if ((count || 0) >= 12) {
      return new Response(JSON.stringify({ error: "قاعدة البيانات تحتوي بالفعل على بيانات. قم بحذف البيانات أولاً." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wilaya IDs
    const { data: wilayas } = await supabase.from("wilayas").select("id, name");
    const wilayaIds = wilayas?.map(w => w.id) || [];
    const wilayaMap = wilayas?.reduce((m, w) => ({ ...m, [w.name]: w.id }), {} as Record<string, string>) || {};

    // ─── 0. ADMIN USER ───
    const { data: body } = await req.json().catch(() => ({ data: null })) || {};
    const adminEmail = body?.adminEmail || "admin@dzsports.com";
    const adminPassword = body?.adminPassword || "Admin123!";

    // Create admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (adminUser?.user) {
      await supabase.from("user_roles").insert({ user_id: adminUser.user.id, role: "admin" });
      summary.admin_user = 1;
    } else {
      console.log("Admin user may already exist:", adminError?.message);
      // Try to find existing user and assign role
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(u => u.email === adminEmail);
      if (existing) {
        const { data: hasRole } = await supabase.from("user_roles").select("id").eq("user_id", existing.id).eq("role", "admin").maybeSingle();
        if (!hasRole) await supabase.from("user_roles").insert({ user_id: existing.id, role: "admin" });
        summary.admin_user = 1;
      }
    }

    // ─── 1. SETTINGS ───
    const settingsData = [
      { key: "store_name", value: "DZ Sports" },
      { key: "store_description", value: "المتجر الرياضي #1 في الجزائر" },
      { key: "currency", value: "د.ج" },
      { key: "primary_color", value: "#22c55e" },
      { key: "whatsapp_number", value: "0555123456" },
    ];
    for (const s of settingsData) {
      const { data: existing } = await supabase.from("settings").select("id").eq("key", s.key).maybeSingle();
      if (!existing) await supabase.from("settings").insert(s);
      else await supabase.from("settings").update({ value: s.value }).eq("key", s.key);
    }
    summary.settings = settingsData.length;

    // ─── 2. SPORTS PRODUCTS ───
    const products = [
      { name: "حذاء جري Nike Air Max", category: ["جري", "أحذية"], price: 12500, old_price: 15000, stock: 30, description: "حذاء جري احترافي Nike Air Max مع تقنية امتصاص الصدمات، نعل مرن ومريح للتدريب اليومي والماراثون", short_description: "حذاء جري احترافي", sku: "SHOE-001", slug: "nike-air-max", product_type: "physical", has_variants: true },
      { name: "كرة قدم Adidas Pro", category: ["كرة القدم"], price: 4500, old_price: 5500, stock: 50, description: "كرة قدم احترافية Adidas معتمدة من FIFA، خياطة يدوية، مقاومة للماء", short_description: "كرة قدم احترافية FIFA", sku: "BALL-001", slug: "adidas-football", product_type: "physical" },
      { name: "طقم ملابس رياضية Nike Dri-FIT", category: ["لياقة بدنية", "ملابس رياضية"], price: 7800, old_price: 9500, stock: 25, description: "طقم تدريب كامل Nike Dri-FIT بتقنية التهوية المتقدمة، يشمل تيشرت وشورت", short_description: "طقم تدريب متكامل", sku: "SET-001", slug: "nike-drifit-set", product_type: "physical", has_variants: true },
      { name: "دمبل حديد قابل للتعديل 20 كغ", category: ["لياقة بدنية", "معدات"], price: 8500, stock: 15, description: "دمبل حديد قابل للتعديل من 2.5 إلى 20 كغ، طلاء مطاطي مانع للانزلاق، مثالي للتدريب المنزلي", short_description: "دمبل قابل للتعديل", sku: "DUMB-001", slug: "adjustable-dumbbell", product_type: "physical" },
      { name: "مضرب تنس Wilson Pro Staff", category: ["تنس"], price: 15000, old_price: 18000, stock: 10, description: "مضرب تنس Wilson Pro Staff V14، وزن 315 غ، مثالي للاعبين المتقدمين", short_description: "مضرب تنس احترافي", sku: "TENNIS-001", slug: "wilson-pro-staff", product_type: "physical" },
      { name: "ساعة رياضية Garmin Forerunner", category: ["إكسسوارات", "جري"], price: 25000, old_price: 30000, stock: 8, description: "ساعة GPS رياضية مع مراقبة نبضات القلب، تتبع السعرات الحرارية، مقاومة للماء 50 متر", short_description: "ساعة GPS رياضية", sku: "WATCH-001", slug: "garmin-forerunner", product_type: "physical" },
      { name: "حقيبة رياضية Under Armour", category: ["إكسسوارات"], price: 5500, old_price: 6500, stock: 35, description: "حقيبة رياضية كبيرة مع جيب أحذية منفصل، مقاومة للماء، سعة 60 لتر", short_description: "حقيبة رياضية 60L", sku: "BAG-001", slug: "under-armour-bag", product_type: "physical" },
      { name: "كرة سلة Spalding NBA", category: ["كرة السلة"], price: 6000, old_price: 7000, stock: 20, description: "كرة سلة Spalding رسمية NBA، جلد صناعي متين، مقاس 7", short_description: "كرة سلة NBA رسمية", sku: "BBALL-001", slug: "spalding-nba", product_type: "physical" },
      { name: "بنش بريس متعدد الاستخدام", category: ["لياقة بدنية", "معدات"], price: 35000, old_price: 42000, stock: 5, description: "بنش بريس قابل للتعديل مع حامل بار، يدعم حتى 300 كغ، مثالي لصالة المنزل", short_description: "بنش بريس احترافي", sku: "BENCH-001", slug: "multi-bench-press", product_type: "physical" },
      { name: "نظارة سباحة Arena Cobra", category: ["سباحة"], price: 3500, old_price: 4200, stock: 40, description: "نظارة سباحة Arena Cobra Ultra مع تقنية مانعة للضباب وحماية UV", short_description: "نظارة سباحة احترافية", sku: "SWIM-001", slug: "arena-cobra", product_type: "physical" },
      { name: "حبل قفز سرعة احترافي", category: ["لياقة بدنية", "معدات"], price: 1800, stock: 60, description: "حبل قفز سرعة مع مقابض ألمنيوم، كابل فولاذي قابل للتعديل، مثالي للكروسفيت", short_description: "حبل قفز احترافي", sku: "ROPE-001", slug: "speed-jump-rope", product_type: "physical" },
      { name: "قفازات ملاكمة Everlast Pro", category: ["ملاكمة"], price: 6500, old_price: 8000, stock: 18, description: "قفازات ملاكمة Everlast Pro 12 أوقية، جلد طبيعي، حشوة IMF لأقصى حماية", short_description: "قفازات ملاكمة احترافية", sku: "BOX-001", slug: "everlast-gloves", product_type: "physical", has_variants: true },
      { name: "حذاء كرة قدم Puma Future", category: ["كرة القدم", "أحذية"], price: 11000, old_price: 13500, stock: 22, description: "حذاء كرة قدم Puma Future Z مع نعل AG للملاعب الاصطناعية، خفيف الوزن", short_description: "حذاء كرة قدم", sku: "FSHOE-001", slug: "puma-future", product_type: "physical", has_variants: true },
      { name: "سجادة يوغا TPE مزدوجة", category: ["لياقة بدنية", "يوغا"], price: 3200, stock: 45, description: "سجادة يوغا TPE سمك 8مم، مزدوجة الوجه مانعة للانزلاق، صديقة للبيئة", short_description: "سجادة يوغا 8مم", sku: "YOGA-001", slug: "tpe-yoga-mat", product_type: "physical" },
      { name: "بروتين واي جولد ستاندرد 2.27 كغ", category: ["مكملات غذائية"], price: 14000, old_price: 16500, stock: 12, description: "بروتين واي Optimum Nutrition Gold Standard، 75 حصة، نكهة شوكولاتة", short_description: "بروتين واي 2.27كغ", sku: "PROT-001", slug: "whey-gold-standard", product_type: "physical" },
    ];

    const productIds: string[] = [];
    for (const product of products) {
      const { data: inserted, error } = await supabase.from("products").insert({
        ...product,
        images: [],
        is_active: true,
        main_image_index: 0,
      }).select("id").single();

      if (error) { console.error("Product insert error:", error); continue; }
      productIds.push(inserted.id);
    }
    summary.products = productIds.length;

    // ─── 3. PRODUCT VARIANTS ───
    // Running shoes (0) - sizes
    if (productIds[0]) {
      for (const size of [39, 40, 41, 42, 43, 44, 45]) {
        await supabase.from("product_variants").insert({
          product_id: productIds[0], option_values: { المقاس: size.toString() }, price: 12500, quantity: 4,
        });
      }
    }
    // Nike set (2) - sizes
    if (productIds[2]) {
      for (const size of ["S", "M", "L", "XL", "XXL"]) {
        await supabase.from("product_variants").insert({
          product_id: productIds[2], option_values: { المقاس: size }, price: 7800, quantity: 5,
        });
      }
    }
    // Boxing gloves (11) - weight
    if (productIds[11]) {
      for (const w of ["10 أوقية", "12 أوقية", "14 أوقية", "16 أوقية"]) {
        await supabase.from("product_variants").insert({
          product_id: productIds[11], option_values: { الوزن: w }, price: 6500, quantity: 4,
        });
      }
    }
    // Football shoes (12) - sizes
    if (productIds[12]) {
      for (const size of [39, 40, 41, 42, 43, 44]) {
        await supabase.from("product_variants").insert({
          product_id: productIds[12], option_values: { المقاس: size.toString() }, price: 11000, quantity: 3,
        });
      }
    }
    summary.product_variants = 22;

    // ─── 4. VARIATION OPTIONS ───
    const varOptions = [
      { variation_type: "اللون", variation_value: "أسود", color_code: "#000000" },
      { variation_type: "اللون", variation_value: "أبيض", color_code: "#FFFFFF" },
      { variation_type: "اللون", variation_value: "أحمر", color_code: "#EF4444" },
      { variation_type: "اللون", variation_value: "أزرق", color_code: "#3B82F6" },
      { variation_type: "اللون", variation_value: "أخضر", color_code: "#22C55E" },
      { variation_type: "المقاس", variation_value: "S" },
      { variation_type: "المقاس", variation_value: "M" },
      { variation_type: "المقاس", variation_value: "L" },
      { variation_type: "المقاس", variation_value: "XL" },
      { variation_type: "المقاس", variation_value: "XXL" },
      { variation_type: "المقاس", variation_value: "39" },
      { variation_type: "المقاس", variation_value: "40" },
      { variation_type: "المقاس", variation_value: "41" },
      { variation_type: "المقاس", variation_value: "42" },
      { variation_type: "المقاس", variation_value: "43" },
      { variation_type: "المقاس", variation_value: "44" },
      { variation_type: "المقاس", variation_value: "45" },
    ];
    await supabase.from("variation_options").insert(varOptions);
    summary.variation_options = varOptions.length;

    // ─── 5. CLIENTS ───
    const clientNames = [
      { name: "محمد بن عمر", phone: "0551234567", wilaya: "الجزائر" },
      { name: "فاطمة الزهراء", phone: "0662345678", wilaya: "وهران" },
      { name: "أحمد بوزيد", phone: "0773456789", wilaya: "قسنطينة" },
      { name: "خديجة مراد", phone: "0554567890", wilaya: "عنابة" },
      { name: "يوسف حمادي", phone: "0665678901", wilaya: "سطيف" },
      { name: "مريم بلقاسم", phone: "0776789012", wilaya: "باتنة" },
      { name: "عبد الرحمن شريف", phone: "0557890123", wilaya: "تلمسان" },
      { name: "سارة بن حسين", phone: "0668901234", wilaya: "بجاية" },
      { name: "إسماعيل قادري", phone: "0779012345", wilaya: "البليدة" },
      { name: "نورة العربي", phone: "0550123456", wilaya: "بسكرة" },
    ];
    const { data: insertedClients } = await supabase.from("clients").insert(
      clientNames.map(c => ({ ...c, status: "active" }))
    ).select("id");
    const clientIds = insertedClients?.map(c => c.id) || [];
    summary.clients = clientIds.length;

    // ─── 6. ORDERS ───
    const statuses = ["جديد", "مؤكد", "قيد التوصيل", "تم التسليم", "ملغي"];
    const orderIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const status = statuses[i % 5];
      const wilayaId = wilayaIds[i % wilayaIds.length];
      const clientIdx = i % clientNames.length;
      const deliveryType = Math.random() > 0.5 ? "home" : "office";
      const shippingCost = deliveryType === "home" ? 800 : 400;
      const subtotal = Math.floor(Math.random() * 20000) + 3000;

      const { data: order, error } = await supabase.from("orders").insert({
        customer_name: clientNames[clientIdx].name,
        customer_phone: clientNames[clientIdx].phone,
        wilaya_id: wilayaId,
        status,
        delivery_type: deliveryType,
        shipping_cost: shippingCost,
        subtotal,
        total_amount: subtotal + shippingCost,
        created_at: date,
        order_number: "placeholder",
        address: deliveryType === "home" ? `شارع ${i + 1}، حي السلام` : null,
      }).select("id").single();

      if (error) { console.error("Order error:", error); continue; }
      orderIds.push(order.id);
    }
    summary.orders = orderIds.length;

    // ─── 7. ORDER ITEMS ───
    let orderItemCount = 0;
    const orderItemIds: string[] = [];
    for (let i = 0; i < orderIds.length; i++) {
      const itemCount = Math.random() > 0.6 ? 2 : 1;
      for (let j = 0; j < itemCount; j++) {
        const prodIdx = (i + j) % productIds.length;
        const qty = Math.floor(Math.random() * 3) + 1;
        const { data: oi } = await supabase.from("order_items").insert({
          order_id: orderIds[i],
          product_id: productIds[prodIdx],
          quantity: qty,
          unit_price: products[prodIdx].price,
        }).select("id").single();
        if (oi) orderItemIds.push(oi.id);
        orderItemCount++;
      }
    }
    summary.order_items = orderItemCount;

    // ─── 8. REVIEWS ───
    const reviewComments = [
      "منتج ممتاز! جودة عالية واستلمته بسرعة",
      "أفضل حذاء رياضي اشتريته، مريح جداً للجري",
      "سعر مناسب مقارنة بالمحلات، والتوصيل سريع",
      "المنتج مطابق للوصف تماماً، أنصح به بشدة",
      "تجربة شراء رائعة، خدمة عملاء ممتازة",
      "استخدمه للتدريب يومياً، جودة لا تُضاهى",
      "وصل في الوقت المحدد والتغليف ممتاز",
      "أفضل متجر رياضي في الجزائر بدون منازع",
      "معدات احترافية بأسعار معقولة، شكراً DZ Sports",
      "سأعيد الشراء بالتأكيد، 5 نجوم!",
    ];
    const reviewers = ["أحمد م.", "سارة ب.", "محمد ع.", "فاطمة ز.", "يوسف ح.", "نورة ل.", "كريم د.", "مريم ق.", "عمر ب.", "خديجة ر."];
    const reviewInserts = [];
    for (let i = 0; i < 25; i++) {
      reviewInserts.push({
        product_id: productIds[i % productIds.length],
        rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
        reviewer_name: reviewers[i % reviewers.length],
        comment: reviewComments[i % reviewComments.length],
      });
    }
    await supabase.from("reviews").insert(reviewInserts);
    summary.reviews = 25;

    // ─── 9. SUPPLIERS ───
    const suppliersData = [
      { name: "مؤسسة الرياضة للمعدات", contact_name: "رشيد بلحاج", contact_phone: "0550111222", contact_email: "sport@email.com", category: "معدات رياضية", status: "active" },
      { name: "شركة النصر للأحذية", contact_name: "سمير مقران", contact_phone: "0661222333", contact_email: "nasr@email.com", category: "أحذية", status: "active" },
      { name: "مؤسسة الطاقة للمكملات", contact_name: "عبد القادر حمدي", contact_phone: "0772333444", contact_email: "energy@email.com", category: "مكملات غذائية", status: "active" },
      { name: "شركة البطل للملابس الرياضية", contact_name: "نادية فرحات", contact_phone: "0553444555", contact_email: "batal@email.com", category: "ملابس رياضية", status: "active" },
    ];
    const { data: insertedSuppliers } = await supabase.from("suppliers").insert(suppliersData).select("id");
    const supplierIds = insertedSuppliers?.map(s => s.id) || [];
    summary.suppliers = supplierIds.length;

    // ─── 10. SUPPLIER PRODUCTS ───
    if (supplierIds.length >= 4) {
      const spData = [
        { supplier_id: supplierIds[0], product_name: "دمبل حديد 10كغ", unit_price: 3000, quantity_received: 100, remaining_stock: 45, unit: "pcs" },
        { supplier_id: supplierIds[0], product_name: "بار أولمبي 20كغ", unit_price: 8000, quantity_received: 50, remaining_stock: 20, unit: "pcs" },
        { supplier_id: supplierIds[1], product_name: "نعل أحذية EVA", unit_price: 500, quantity_received: 500, remaining_stock: 200, unit: "pcs" },
        { supplier_id: supplierIds[1], product_name: "جلد صناعي رياضي", unit_price: 1200, quantity_received: 200, remaining_stock: 80, unit: "متر" },
        { supplier_id: supplierIds[2], product_name: "بروتين خام", unit_price: 5000, quantity_received: 100, remaining_stock: 40, unit: "كغ" },
        { supplier_id: supplierIds[2], product_name: "كرياتين مونوهيدرات", unit_price: 3500, quantity_received: 80, remaining_stock: 35, unit: "كغ" },
        { supplier_id: supplierIds[3], product_name: "قماش دراي فيت", unit_price: 800, quantity_received: 300, remaining_stock: 120, unit: "متر" },
        { supplier_id: supplierIds[3], product_name: "سحابات رياضية", unit_price: 100, quantity_received: 1000, remaining_stock: 600, unit: "pcs" },
      ];
      await supabase.from("supplier_products").insert(spData);
      summary.supplier_products = spData.length;
    }

    // ─── 11. COUPONS ───
    const couponsData = [
      { code: "SPORT10", discount_type: "percentage", discount_value: 10, is_active: true, expiry_date: "2026-12-31T23:59:59Z" },
      { code: "WELCOME500", discount_type: "fixed", discount_value: 500, is_active: true, expiry_date: "2026-06-30T23:59:59Z" },
      { code: "FITNESS20", discount_type: "percentage", discount_value: 20, is_active: true, expiry_date: "2026-09-01T23:59:59Z" },
      { code: "FREESHIP", discount_type: "fixed", discount_value: 800, is_active: true, expiry_date: "2026-12-31T23:59:59Z" },
    ];
    await supabase.from("coupons").insert(couponsData);
    summary.coupons = 4;

    // ─── 12. LEADS ───
    const leadsData = [
      { name: "هشام قاسمي", phone: "0550111000", status: "جديد", source: "فيسبوك" },
      { name: "رانيا بلخير", phone: "0661222000", status: "جديد", source: "موقع" },
      { name: "توفيق مرابط", phone: "0772333000", status: "مهتم", source: "إنستغرام" },
      { name: "صبرينة خليفي", phone: "0553444000", status: "مهتم", source: "فيسبوك" },
      { name: "بلال حماني", phone: "0664555000", status: "تم التحويل", source: "موقع" },
    ];
    await supabase.from("leads").insert(leadsData);
    summary.leads = 5;

    // ─── 13. CONFIRMERS ───
    const confirmersData = [
      { name: "سعيد مهدي", phone: "0550999111", email: "said@confirm.dz", type: "private", payment_mode: "per_order", confirmation_price: 100, cancellation_price: 50 },
      { name: "ليندة حسان", phone: "0661888222", email: "linda@confirm.dz", type: "private", payment_mode: "per_order", confirmation_price: 120, cancellation_price: 60 },
    ];
    await supabase.from("confirmers").insert(confirmersData);
    summary.confirmers = 2;

    // ─── 14. DELIVERY COMPANIES ───
    const dcData = [
      { name: "ZR Express", is_active: true, is_builtin: false },
      { name: "Ecotrack", is_active: true, is_builtin: false },
    ];
    const { data: newDCs } = await supabase.from("delivery_companies").insert(dcData).select("id");
    summary.delivery_companies = dcData.length;

    // ─── 15. RETURN REASONS ───
    const returnReasons = [
      { label_ar: "المنتج تالف أو مكسور", fault_type: "seller_fault", requires_photos: true, position: 1 },
      { label_ar: "المنتج لا يطابق الوصف", fault_type: "seller_fault", requires_photos: true, position: 2 },
      { label_ar: "مقاس غير مناسب", fault_type: "customer_fault", requires_photos: false, position: 3 },
      { label_ar: "غيرت رأيي", fault_type: "customer_fault", requires_photos: false, position: 4 },
    ];
    await supabase.from("return_reasons").insert(returnReasons);
    summary.return_reasons = 4;

    // ─── 16. RETURN SETTINGS ───
    const { count: rsCount } = await supabase.from("return_settings").select("*", { count: "exact", head: true });
    if (!rsCount || rsCount === 0) {
      await supabase.from("return_settings").insert({
        is_returns_enabled: true, return_window_days: 7, require_return_photos: true,
        max_photos_per_return: 5, allow_refund: true, allow_exchange: true, allow_store_credit: true,
        return_policy_text: "يمكنك إرجاع المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون في حالته الأصلية.",
      });
    }
    summary.return_settings = 1;

    // ─── 17. PRODUCT COSTS ───
    const costInserts = productIds.slice(0, 10).map((pid, i) => ({
      product_id: pid,
      purchase_cost: Math.floor(products[i].price * 0.4),
      packaging_cost: Math.floor(Math.random() * 200) + 50,
      storage_cost: Math.floor(Math.random() * 100) + 20,
      other_cost: Math.floor(Math.random() * 150),
      other_cost_label: "نقل",
    }));
    await supabase.from("product_costs").insert(costInserts);
    summary.product_costs = costInserts.length;

    // ─── 18. CONFIRMATION SETTINGS ───
    const { count: csCount } = await supabase.from("confirmation_settings").select("*", { count: "exact", head: true });
    if (!csCount || csCount === 0) {
      await supabase.from("confirmation_settings").insert({
        assignment_mode: "manual", max_call_attempts: 3, auto_timeout_minutes: 30,
        working_hours_start: "08:00", working_hours_end: "20:00",
      });
    }
    summary.confirmation_settings = 1;

    // ─── 19. ABANDONED ORDERS ───
    const abandonedData = [
      { customer_name: "علي بوشارب", customer_phone: "0550222333", customer_wilaya: "الجزائر", cart_items: JSON.stringify([{ name: "حذاء جري Nike", qty: 1, price: 12500 }]), cart_total: 12500, item_count: 1 },
      { customer_name: "نادية قرمي", customer_phone: "0661333444", customer_wilaya: "وهران", cart_items: JSON.stringify([{ name: "بنش بريس", qty: 1, price: 35000 }]), cart_total: 35000, item_count: 1 },
      { customer_name: "حسام بريك", customer_phone: "0772444555", customer_wilaya: "قسنطينة", cart_items: JSON.stringify([{ name: "ساعة Garmin", qty: 1, price: 25000 }]), cart_total: 25000, item_count: 1 },
    ];
    await supabase.from("abandoned_orders").insert(abandonedData);
    summary.abandoned_orders = 3;

    console.log("✅ Seed complete:", summary);
    return new Response(JSON.stringify({
      success: true,
      summary,
      admin: { email: adminEmail, password: adminPassword },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Seed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
