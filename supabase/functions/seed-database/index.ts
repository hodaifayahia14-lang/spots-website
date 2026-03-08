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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const summary: Record<string, number> = {};

    // Check if already seeded
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: "Database already has data. Clear tables first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wilaya IDs
    const { data: wilayas } = await supabase.from("wilayas").select("id, name");
    const wilayaIds = wilayas?.map(w => w.id) || [];
    const wilayaMap = wilayas?.reduce((m, w) => ({ ...m, [w.name]: w.id }), {} as Record<string, string>) || {};

    // ─── 1. SETTINGS ───
    const settingsData = [
      { key: "store_name", value: "متجر الجزائر" },
      { key: "store_description", value: "أفضل متجر إلكتروني في الجزائر" },
      { key: "currency", value: "د.ج" },
      { key: "primary_color", value: "#2563eb" },
      { key: "whatsapp_number", value: "0555123456" },
    ];
    for (const s of settingsData) {
      const { data: existing } = await supabase.from("settings").select("id").eq("key", s.key).maybeSingle();
      if (!existing) await supabase.from("settings").insert(s);
      else await supabase.from("settings").update({ value: s.value }).eq("key", s.key);
    }
    summary.settings = settingsData.length;

    // ─── 2. PRODUCTS ───
    const products = [
      { name: "هاتف ذكي سامسونج A54", category: ["إلكترونيات"], price: 45000, old_price: 52000, stock: 25, description: "هاتف سامسونج Galaxy A54 بشاشة 6.4 بوصة، كاميرا 50 ميغابيكسل", short_description: "هاتف ذكي بمواصفات عالية", sku: "PHONE-001", slug: "samsung-a54", product_type: "physical" },
      { name: "سماعات بلوتوث لاسلكية", category: ["إلكترونيات", "إكسسوارات"], price: 3500, old_price: 4500, stock: 50, description: "سماعات بلوتوث 5.0 مع علبة شحن، عزل ضوضاء نشط", short_description: "سماعات لاسلكية عالية الجودة", sku: "AUDIO-001", slug: "bluetooth-earbuds", product_type: "physical" },
      { name: "حقيبة يد جلدية نسائية", category: ["أزياء", "إكسسوارات"], price: 6500, old_price: 8000, stock: 15, description: "حقيبة يد من الجلد الطبيعي، تصميم أنيق مع عدة جيوب", short_description: "حقيبة جلدية أنيقة", sku: "BAG-001", slug: "leather-handbag", product_type: "physical", has_variants: true },
      { name: "عسل طبيعي سدر", category: ["غذاء", "صحة"], price: 4500, stock: 30, description: "عسل سدر طبيعي 100% من جبال الجزائر، 500 غرام", short_description: "عسل طبيعي نقي", sku: "HONEY-001", slug: "sidr-honey", product_type: "physical" },
      { name: "كريم مرطب للبشرة", category: ["جمال", "صحة"], price: 2200, old_price: 2800, stock: 40, description: "كريم مرطب طبيعي بزيت الأركان وفيتامين E", short_description: "كريم مرطب طبيعي", sku: "BEAUTY-001", slug: "moisturizing-cream", product_type: "physical" },
      { name: "ساعة يد رجالية كلاسيكية", category: ["إكسسوارات", "أزياء"], price: 8500, old_price: 12000, stock: 10, description: "ساعة يد رجالية بتصميم كلاسيك، مقاومة للماء", short_description: "ساعة رجالية أنيقة", sku: "WATCH-001", slug: "classic-watch", product_type: "physical", has_variants: true },
      { name: "طقم أواني مطبخ", category: ["منزل"], price: 12000, old_price: 15000, stock: 8, description: "طقم أواني طبخ من الستانلس ستيل، 12 قطعة مع أغطية", short_description: "طقم أواني 12 قطعة", sku: "KITCHEN-001", slug: "kitchen-set", product_type: "physical" },
      { name: "حذاء رياضي نايك", category: ["رياضة", "أزياء"], price: 9500, old_price: 11000, stock: 20, description: "حذاء رياضي مريح للجري والمشي اليومي، نعل مرن", short_description: "حذاء رياضي مريح", sku: "SHOE-001", slug: "nike-sports-shoe", product_type: "physical", has_variants: true },
      { name: "عطر رجالي فاخر", category: ["جمال"], price: 7000, old_price: 9000, stock: 18, description: "عطر رجالي فاخر برائحة خشبية مميزة، 100 مل", short_description: "عطر فاخر 100 مل", sku: "PERFUME-001", slug: "luxury-perfume", product_type: "physical" },
      { name: "لابتوب لينوفو IdeaPad", category: ["إلكترونيات"], price: 85000, old_price: 95000, stock: 5, description: "لابتوب لينوفو بمعالج i5، ذاكرة 8GB، تخزين 256GB SSD", short_description: "لابتوب بمواصفات جيدة", sku: "LAPTOP-001", slug: "lenovo-ideapad", product_type: "physical" },
      { name: "تمر دقلة نور ممتاز", category: ["غذاء"], price: 1800, stock: 60, description: "تمر دقلة نور ممتاز من ولاية بسكرة، 1 كيلو", short_description: "تمر جزائري ممتاز", sku: "DATES-001", slug: "deglet-noor", product_type: "physical" },
      { name: "طاولة قهوة خشبية", category: ["منزل"], price: 15000, old_price: 18000, stock: 6, description: "طاولة قهوة من خشب الزان الطبيعي، تصميم عصري", short_description: "طاولة قهوة أنيقة", sku: "FURN-001", slug: "coffee-table", product_type: "physical" },
      { name: "زيت زيتون بكر", category: ["غذاء", "صحة"], price: 2500, stock: 45, description: "زيت زيتون بكر ممتاز من منطقة القبائل، 1 لتر", short_description: "زيت زيتون طبيعي", sku: "OIL-001", slug: "olive-oil", product_type: "physical" },
      { name: "قميص قطني رجالي", category: ["أزياء"], price: 3200, old_price: 4000, stock: 35, description: "قميص قطني 100% بألوان متعددة، مريح للارتداء اليومي", short_description: "قميص قطني مريح", sku: "SHIRT-001", slug: "cotton-shirt", product_type: "physical", has_variants: true },
      { name: "شاحن متعدد المنافذ", category: ["إلكترونيات", "إكسسوارات"], price: 2800, old_price: 3500, stock: 55, description: "شاحن USB-C سريع 65 وات مع 4 منافذ", short_description: "شاحن سريع 65W", sku: "CHARGE-001", slug: "multi-charger", product_type: "physical" },
    ];

    // Generate images for products
    const productIds: string[] = [];
    for (const product of products) {
      let images: string[] = [];

      if (LOVABLE_API_KEY) {
        try {
          const prompt = `Professional product photography of "${product.name}" on a clean white background, e-commerce style, high quality, well-lit, centered composition`;
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imageData) {
              const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
              const binaryData = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
              const fileName = `seed-${product.slug}-${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from("products")
                .upload(fileName, binaryData, { contentType: "image/png", upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from("products").getPublicUrl(fileName);
                images = [urlData.publicUrl];
              }
            }
          }
          // Rate limit delay
          await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          console.error(`Image gen failed for ${product.name}:`, err);
        }
      }

      const { data: inserted, error } = await supabase.from("products").insert({
        ...product,
        images,
        is_active: true,
        main_image_index: 0,
      }).select("id").single();

      if (error) { console.error("Product insert error:", error); continue; }
      productIds.push(inserted.id);
    }
    summary.products = productIds.length;

    // ─── 3. PRODUCT VARIANTS (for has_variants products) ───
    // Handbag (index 2) - colors
    if (productIds[2]) {
      const colors = [
        { option_values: { اللون: "أسود" }, price: 6500, quantity: 5 },
        { option_values: { اللون: "بني" }, price: 6500, quantity: 5 },
        { option_values: { اللون: "أحمر" }, price: 7000, quantity: 5 },
      ];
      for (const v of colors) {
        await supabase.from("product_variants").insert({ product_id: productIds[2], ...v });
      }
    }

    // Watch (index 5) - colors
    if (productIds[5]) {
      const variants = [
        { option_values: { اللون: "فضي" }, price: 8500, quantity: 4 },
        { option_values: { اللون: "ذهبي" }, price: 9000, quantity: 3 },
        { option_values: { اللون: "أسود" }, price: 8500, quantity: 3 },
      ];
      for (const v of variants) {
        await supabase.from("product_variants").insert({ product_id: productIds[5], ...v });
      }
    }

    // Sports shoe (index 7) - sizes
    if (productIds[7]) {
      for (const size of [40, 41, 42, 43, 44]) {
        await supabase.from("product_variants").insert({
          product_id: productIds[7],
          option_values: { المقاس: size.toString() },
          price: 9500,
          quantity: 4,
        });
      }
    }

    // Cotton shirt (index 13) - sizes + colors
    if (productIds[13]) {
      const combos = [
        { option_values: { المقاس: "M", اللون: "أبيض" }, price: 3200, quantity: 5 },
        { option_values: { المقاس: "L", اللون: "أبيض" }, price: 3200, quantity: 5 },
        { option_values: { المقاس: "M", اللون: "أزرق" }, price: 3200, quantity: 5 },
        { option_values: { المقاس: "L", اللون: "أزرق" }, price: 3200, quantity: 5 },
        { option_values: { المقاس: "XL", اللون: "أسود" }, price: 3400, quantity: 5 },
      ];
      for (const v of combos) {
        await supabase.from("product_variants").insert({ product_id: productIds[13], ...v });
      }
    }
    summary.product_variants = 16;

    // ─── 4. VARIATION OPTIONS ───
    const varOptions = [
      { variation_type: "اللون", variation_value: "أسود", color_code: "#000000" },
      { variation_type: "اللون", variation_value: "أبيض", color_code: "#FFFFFF" },
      { variation_type: "اللون", variation_value: "أحمر", color_code: "#EF4444" },
      { variation_type: "اللون", variation_value: "أزرق", color_code: "#3B82F6" },
      { variation_type: "اللون", variation_value: "بني", color_code: "#8B5E3C" },
      { variation_type: "اللون", variation_value: "فضي", color_code: "#C0C0C0" },
      { variation_type: "اللون", variation_value: "ذهبي", color_code: "#FFD700" },
      { variation_type: "المقاس", variation_value: "S" },
      { variation_type: "المقاس", variation_value: "M" },
      { variation_type: "المقاس", variation_value: "L" },
      { variation_type: "المقاس", variation_value: "XL" },
      { variation_type: "المقاس", variation_value: "40" },
      { variation_type: "المقاس", variation_value: "41" },
      { variation_type: "المقاس", variation_value: "42" },
      { variation_type: "المقاس", variation_value: "43" },
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
      { name: "كريم دحماني", phone: "0661234567", wilaya: "تيزي وزو" },
      { name: "أمينة مسعودي", phone: "0772345678", wilaya: "الشلف" },
      { name: "رضا بوعلام", phone: "0553456789", wilaya: "الأغواط" },
      { name: "ليلى حداد", phone: "0664567890", wilaya: "أدرار" },
      { name: "عمر بختي", phone: "0775678901", wilaya: "أم البواقي" },
    ];
    const { data: insertedClients } = await supabase.from("clients").insert(
      clientNames.map(c => ({ ...c, status: "active" }))
    ).select("id");
    const clientIds = insertedClients?.map(c => c.id) || [];
    summary.clients = clientIds.length;

    // ─── 6. ORDERS (30 orders) ───
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
      const subtotal = Math.floor(Math.random() * 20000) + 2000;

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
      "منتج ممتاز، أنصح به بشدة",
      "جودة عالية والتوصيل سريع",
      "سعر مناسب مقارنة بالسوق",
      "المنتج مطابق للوصف تماماً",
      "تجربة شراء رائعة",
      "سأعيد الشراء بالتأكيد",
      "جيد لكن التغليف يحتاج تحسين",
      "خدمة عملاء ممتازة",
      "وصل في الوقت المحدد",
      "أفضل متجر تعاملت معه",
    ];
    const reviewers = ["أحمد م.", "سارة ب.", "محمد ع.", "فاطمة ز.", "يوسف ح.", "نورة ل.", "كريم د.", "مريم ق.", "عمر ب.", "خديجة ر."];
    const reviewInserts = [];
    for (let i = 0; i < 20; i++) {
      reviewInserts.push({
        product_id: productIds[i % productIds.length],
        rating: Math.floor(Math.random() * 3) + 3,
        reviewer_name: reviewers[i % reviewers.length],
        comment: reviewComments[i % reviewComments.length],
      });
    }
    await supabase.from("reviews").insert(reviewInserts);
    summary.reviews = 20;

    // ─── 9. SUPPLIERS ───
    const suppliersData = [
      { name: "مؤسسة الأمل للإلكترونيات", contact_name: "رشيد بلحاج", contact_phone: "0550111222", contact_email: "amel@email.com", category: "إلكترونيات", status: "active" },
      { name: "شركة النجاح للأزياء", contact_name: "سمير مقران", contact_phone: "0661222333", contact_email: "najah@email.com", category: "أزياء", status: "active" },
      { name: "مؤسسة البركة للعسل والتمور", contact_name: "عبد القادر حمدي", contact_phone: "0772333444", contact_email: "baraka@email.com", category: "غذاء", status: "active" },
      { name: "شركة الجمال للعناية", contact_name: "نادية فرحات", contact_phone: "0553444555", contact_email: "jamal@email.com", category: "جمال", status: "active" },
      { name: "مؤسسة الدار للأثاث", contact_name: "مصطفى خالدي", contact_phone: "0664555666", contact_email: "dar@email.com", category: "منزل", status: "active" },
    ];
    const { data: insertedSuppliers } = await supabase.from("suppliers").insert(suppliersData).select("id");
    const supplierIds = insertedSuppliers?.map(s => s.id) || [];
    summary.suppliers = supplierIds.length;

    // ─── 10. SUPPLIER PRODUCTS ───
    if (supplierIds.length >= 5) {
      const spData = [
        { supplier_id: supplierIds[0], product_name: "شاشة سامسونج 6.4\"", unit_price: 15000, quantity_received: 100, remaining_stock: 45, unit: "pcs" },
        { supplier_id: supplierIds[0], product_name: "بطارية ليثيوم 5000mAh", unit_price: 3000, quantity_received: 200, remaining_stock: 120, unit: "pcs" },
        { supplier_id: supplierIds[0], product_name: "شاحن USB-C 65W", unit_price: 1200, quantity_received: 150, remaining_stock: 80, unit: "pcs" },
        { supplier_id: supplierIds[1], product_name: "قماش قطن تركي", unit_price: 800, quantity_received: 500, remaining_stock: 200, unit: "متر" },
        { supplier_id: supplierIds[1], product_name: "جلد طبيعي إيطالي", unit_price: 2500, quantity_received: 100, remaining_stock: 35, unit: "متر" },
        { supplier_id: supplierIds[1], product_name: "أزرار معدنية", unit_price: 50, quantity_received: 1000, remaining_stock: 600, unit: "pcs" },
        { supplier_id: supplierIds[2], product_name: "عسل سدر خام", unit_price: 2000, quantity_received: 200, remaining_stock: 80, unit: "كغ" },
        { supplier_id: supplierIds[2], product_name: "تمر دقلة نور", unit_price: 800, quantity_received: 500, remaining_stock: 250, unit: "كغ" },
        { supplier_id: supplierIds[2], product_name: "زيت زيتون بكر", unit_price: 1200, quantity_received: 300, remaining_stock: 150, unit: "لتر" },
        { supplier_id: supplierIds[3], product_name: "زيت أركان مغربي", unit_price: 3500, quantity_received: 50, remaining_stock: 20, unit: "لتر" },
        { supplier_id: supplierIds[3], product_name: "عطور خام فرنسية", unit_price: 5000, quantity_received: 30, remaining_stock: 15, unit: "لتر" },
        { supplier_id: supplierIds[4], product_name: "خشب زان طبيعي", unit_price: 4000, quantity_received: 50, remaining_stock: 18, unit: "متر" },
        { supplier_id: supplierIds[4], product_name: "ستانلس ستيل 304", unit_price: 2000, quantity_received: 100, remaining_stock: 40, unit: "كغ" },
        { supplier_id: supplierIds[4], product_name: "طلاء خشب مائي", unit_price: 1500, quantity_received: 80, remaining_stock: 50, unit: "لتر" },
        { supplier_id: supplierIds[4], product_name: "مسامير وبراغي", unit_price: 100, quantity_received: 2000, remaining_stock: 1200, unit: "pcs" },
      ];
      await supabase.from("supplier_products").insert(spData);
      summary.supplier_products = spData.length;
    }

    // ─── 11. SUPPLIER TRANSACTIONS ───
    if (supplierIds.length >= 3) {
      const stData = [
        { supplier_id: supplierIds[0], transaction_type: "receipt", description: "استلام شحنة شاشات وبطاريات", items_received: 100, date: "2026-01-15" },
        { supplier_id: supplierIds[0], transaction_type: "payment", description: "دفعة أولى للمورد", items_given: 0, date: "2026-01-20" },
        { supplier_id: supplierIds[1], transaction_type: "receipt", description: "استلام أقمشة وجلود", items_received: 200, date: "2026-02-01" },
        { supplier_id: supplierIds[1], transaction_type: "return", description: "إرجاع قماش معيب", items_given: 20, date: "2026-02-10" },
        { supplier_id: supplierIds[2], transaction_type: "receipt", description: "شحنة عسل وتمور", items_received: 300, date: "2026-02-15" },
        { supplier_id: supplierIds[2], transaction_type: "payment", description: "تسوية حساب المورد", items_given: 0, date: "2026-02-20" },
        { supplier_id: supplierIds[3], transaction_type: "receipt", description: "استلام زيوت ومواد تجميل", items_received: 80, date: "2026-01-25" },
        { supplier_id: supplierIds[4], transaction_type: "receipt", description: "استلام خشب وأدوات", items_received: 150, date: "2026-03-01" },
        { supplier_id: supplierIds[4], transaction_type: "payment", description: "دفعة مقدمة للأثاث", items_given: 0, date: "2026-03-05" },
        { supplier_id: supplierIds[0], transaction_type: "receipt", description: "شحنة شواحن USB", items_received: 150, date: "2026-03-01" },
      ];
      await supabase.from("supplier_transactions").insert(stData);
      summary.supplier_transactions = stData.length;
    }

    // ─── 12. CONFIRMERS ───
    const confirmersData = [
      { name: "سعيد مهدي", phone: "0550999111", email: "said@confirm.dz", type: "private", payment_mode: "per_order", confirmation_price: 100, cancellation_price: 50 },
      { name: "ليندة حسان", phone: "0661888222", email: "linda@confirm.dz", type: "private", payment_mode: "per_order", confirmation_price: 120, cancellation_price: 60 },
      { name: "أمين بوعكاز", phone: "0772777333", email: "amine@confirm.dz", type: "private", payment_mode: "monthly", monthly_salary: 35000, confirmation_price: 0 },
    ];
    await supabase.from("confirmers").insert(confirmersData);
    summary.confirmers = 3;

    // ─── 13. COUPONS ───
    const couponsData = [
      { code: "WELCOME10", discount_type: "percentage", discount_value: 10, is_active: true, expiry_date: "2026-12-31T23:59:59Z" },
      { code: "SALE500", discount_type: "fixed", discount_value: 500, is_active: true, expiry_date: "2026-06-30T23:59:59Z" },
      { code: "SUMMER20", discount_type: "percentage", discount_value: 20, is_active: true, expiry_date: "2026-09-01T23:59:59Z" },
      { code: "FREESHIP", discount_type: "fixed", discount_value: 800, is_active: true, expiry_date: "2026-12-31T23:59:59Z" },
      { code: "VIP15", discount_type: "percentage", discount_value: 15, is_active: false },
    ];
    await supabase.from("coupons").insert(couponsData);
    summary.coupons = 5;

    // ─── 14. LEADS ───
    const leadsData = [
      { name: "هشام قاسمي", phone: "0550111000", status: "جديد", source: "فيسبوك" },
      { name: "رانيا بلخير", phone: "0661222000", status: "جديد", source: "موقع" },
      { name: "توفيق مرابط", phone: "0772333000", status: "مهتم", source: "إنستغرام" },
      { name: "صبرينة خليفي", phone: "0553444000", status: "مهتم", source: "فيسبوك" },
      { name: "بلال حماني", phone: "0664555000", status: "تم التحويل", source: "موقع" },
      { name: "إيمان بوراس", phone: "0775666000", status: "جديد", source: "واتساب" },
      { name: "عادل شنتوف", phone: "0556777000", status: "ملغي", source: "فيسبوك" },
      { name: "حنان دباغ", phone: "0667888000", status: "مهتم", source: "موقع" },
      { name: "جمال العيد", phone: "0778999000", status: "جديد", source: "إنستغرام" },
      { name: "أسماء بوعزيز", phone: "0559000111", status: "تم التحويل", source: "واتساب" },
    ];
    await supabase.from("leads").insert(leadsData);
    summary.leads = 10;

    // ─── 15. DELIVERY COMPANIES ───
    const dcData = [
      { name: "ZR Express", is_active: true, is_builtin: false },
      { name: "Ecotrack", is_active: true, is_builtin: false },
    ];
    const { data: newDCs } = await supabase.from("delivery_companies").insert(dcData).select("id");
    const allDCIds = [
      "3742a603-e332-4225-bb9c-f6b147eb33de", // yalidin
      ...(newDCs?.map(d => d.id) || []),
    ];
    summary.delivery_companies = dcData.length;

    // ─── 16. DELIVERY COMPANY PRICES ───
    let dcPriceCount = 0;
    for (const dcId of allDCIds) {
      for (const wId of wilayaIds.slice(0, 9)) {
        const baseHome = Math.floor(Math.random() * 400) + 600;
        const baseOffice = baseHome - 200;
        await supabase.from("delivery_company_prices").insert({
          company_id: dcId,
          wilaya_id: wId,
          price_home: baseHome,
          price_office: baseOffice,
          return_price: Math.floor(baseHome * 0.5),
        });
        dcPriceCount++;
      }
    }
    summary.delivery_company_prices = dcPriceCount;

    // ─── 17. FACEBOOK PIXELS ───
    await supabase.from("facebook_pixels").insert([
      { pixel_id: "123456789012345", name: "بيكسل الموقع الرئيسي", is_active: true },
      { pixel_id: "987654321098765", name: "بيكسل إعادة الاستهداف", is_active: false },
    ]);
    summary.facebook_pixels = 2;

    // ─── 18. ABANDONED ORDERS ───
    const abandonedData = [
      { customer_name: "علي بوشارب", customer_phone: "0550222333", customer_wilaya: "الجزائر", cart_items: JSON.stringify([{ name: "هاتف ذكي", qty: 1, price: 45000 }]), cart_total: 45000, item_count: 1 },
      { customer_name: "نادية قرمي", customer_phone: "0661333444", customer_wilaya: "وهران", cart_items: JSON.stringify([{ name: "حقيبة جلدية", qty: 1, price: 6500 }, { name: "عطر", qty: 1, price: 7000 }]), cart_total: 13500, item_count: 2 },
      { customer_name: "حسام بريك", customer_phone: "0772444555", customer_wilaya: "قسنطينة", cart_items: JSON.stringify([{ name: "لابتوب", qty: 1, price: 85000 }]), cart_total: 85000, item_count: 1 },
      { customer_name: "وفاء مخلوفي", customer_phone: "0553555666", customer_wilaya: "سطيف", cart_items: JSON.stringify([{ name: "كريم مرطب", qty: 2, price: 4400 }]), cart_total: 4400, item_count: 2 },
      { customer_name: "ياسين عمران", customer_phone: "0664666777", customer_wilaya: "باتنة", cart_items: JSON.stringify([{ name: "ساعة رجالية", qty: 1, price: 8500 }]), cart_total: 8500, item_count: 1 },
    ];
    await supabase.from("abandoned_orders").insert(abandonedData);
    summary.abandoned_orders = 5;

    // ─── 19. RETURN REASONS ───
    const returnReasons = [
      { label_ar: "المنتج تالف أو مكسور", fault_type: "seller_fault", requires_photos: true, position: 1 },
      { label_ar: "المنتج لا يطابق الوصف", fault_type: "seller_fault", requires_photos: true, position: 2 },
      { label_ar: "مقاس غير مناسب", fault_type: "customer_fault", requires_photos: false, position: 3 },
      { label_ar: "لون مختلف عما طلبت", fault_type: "seller_fault", requires_photos: true, position: 4 },
      { label_ar: "غيرت رأيي", fault_type: "customer_fault", requires_photos: false, position: 5 },
    ];
    await supabase.from("return_reasons").insert(returnReasons);
    summary.return_reasons = 5;

    // ─── 20. RETURN SETTINGS ───
    const { count: rsCount } = await supabase.from("return_settings").select("*", { count: "exact", head: true });
    if (!rsCount || rsCount === 0) {
      await supabase.from("return_settings").insert({
        is_returns_enabled: true,
        return_window_days: 7,
        require_return_photos: true,
        max_photos_per_return: 5,
        allow_refund: true,
        allow_exchange: true,
        allow_store_credit: true,
        return_policy_text: "يمكنك إرجاع المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون في حالته الأصلية.",
      });
    }
    summary.return_settings = 1;

    // ─── 21. RETURN REQUESTS ───
    if (orderIds.length >= 5 && orderItemIds.length >= 5) {
      const { data: rr1 } = await supabase.from("return_requests").insert({
        order_id: orderIds[3],
        customer_name: clientNames[3].name,
        customer_phone: clientNames[3].phone,
        return_number: "placeholder",
        resolution_type: "refund",
        status: "requested",
        total_refund_amount: products[3].price,
        net_refund_amount: products[3].price - 400,
        return_shipping_cost: 400,
        shipping_paid_by: "customer",
      }).select("id").single();

      if (rr1) {
        await supabase.from("return_items").insert({
          return_request_id: rr1.id,
          order_item_id: orderItemIds[3],
          product_id: productIds[3],
          product_name: products[3].name,
          quantity_ordered: 1,
          quantity_returned: 1,
          unit_price: products[3].price,
          item_total: products[3].price,
        });
      }
      summary.return_requests = 1;
    }

    // ─── 22. PRODUCT COSTS ───
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

    // ─── 23. CONFIRMATION SETTINGS ───
    const { count: csCount } = await supabase.from("confirmation_settings").select("*", { count: "exact", head: true });
    if (!csCount || csCount === 0) {
      await supabase.from("confirmation_settings").insert({
        assignment_mode: "manual",
        max_call_attempts: 3,
        auto_timeout_minutes: 30,
        working_hours_start: "08:00",
        working_hours_end: "20:00",
      });
    }
    summary.confirmation_settings = 1;

    console.log("✅ Seed complete:", summary);
    return new Response(JSON.stringify({ success: true, summary }), {
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
